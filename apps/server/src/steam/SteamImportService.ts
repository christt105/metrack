import type { SteamApplyOutcome, SteamImportReport, SteamImportRow } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { HttpError } from '../http/HttpError.js';
import type { IgdbClient } from '../providers/igdb/IgdbClient.js';
import type { SteamClient } from '../providers/steam/SteamClient.js';
import type { SteamOwnedGame } from '../providers/steam/SteamOwnedGame.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import type { VideogameRepository } from '../storage/repositories/VideogameRepository.js';
import { emptyVideogame } from '../media/emptyEntities.js';
import type { SteamClassification } from './SteamClassification.js';
import type { SteamGameAdder } from './SteamGameAdder.js';
import type { SteamImportTarget } from './SteamImportTarget.js';
import { STEAM_APPLY_BUDGET } from './SteamApplyBudget.js';
import { classifySteamGames } from './classifySteamGames.js';

const IGDB_BATCH = 400;

/**
 * Imports the signed-in user's Steam library into their games. The report only reads; applying recomputes the
 * classification of the requested games from Steam's current answer, so nothing the browser sends but app ids is trusted.
 */
export class SteamImportService {
  constructor(
    private readonly steam: SteamClient,
    private readonly igdb: IgdbClient,
    private readonly games: VideogameRepository,
    private readonly adder: SteamGameAdder,
    private readonly settings: UserSettingsRepository,
  ) {}

  async report(userId: number): Promise<SteamImportReport> {
    const steamId = await this.steamIdOf(userId);
    const owned = await this.owned(steamId);
    const { report } = await this.classify(owned);
    return { steamId, ...report };
  }

  /**
   * Writes the requested games, one outcome each; a failure on one does not stop the others. Games that would not fit
   * in `STEAM_APPLY_BUDGET` come back `deferred` and are not touched.
   */
  async apply(userId: number, appIds: readonly string[]): Promise<SteamApplyOutcome[]> {
    const steamId = await this.steamIdOf(userId);
    const wanted = [...new Set(appIds)];
    const owned = (await this.owned(steamId)).filter((game) => wanted.includes(String(game.appid)));
    const { report, targets } = await this.classify(owned);
    const rows = new Map(report.rows.map((row) => [row.appId, row]));
    const outcomes: SteamApplyOutcome[] = [];
    let spent: number = STEAM_APPLY_BUDGET.overhead;
    let written = 0;
    for (const appId of wanted) {
      const target = targets.get(appId);
      const row = rows.get(appId);
      if (!target || !row) {
        outcomes.push({ appId, result: 'skipped' });
        continue;
      }
      const cost = STEAM_APPLY_BUDGET[target.kind];
      if (written > 0 && spent + cost > STEAM_APPLY_BUDGET.limit) {
        outcomes.push({ appId, result: 'deferred' });
        continue;
      }
      spent += cost;
      written += 1;
      outcomes.push(await this.write(appId, row, target));
    }
    return outcomes;
  }

  private async write(
    appId: string,
    row: SteamImportRow,
    target: SteamImportTarget,
  ): Promise<SteamApplyOutcome> {
    try {
      if (target.kind === 'update') {
        await this.games.update(target.entryId, { timeSpentMinutes: target.minutes });
        return { appId, result: 'updated' };
      }
      const entry = {
        status: row.status ?? 'planned',
        timeSpentMinutes: row.playtimeMinutes,
      } as const;
      if (target.kind === 'catalog') {
        await this.games.create({
          ...emptyVideogame(),
          igdbId: target.igdbId,
          steamAppId: appId,
          title: target.title,
          ...entry,
        });
      } else {
        await this.adder.addWith(String(target.igdbId), entry);
      }
      return { appId, result: 'imported' };
    } catch (error) {
      if (error instanceof ApiError && error.code === 'already_added') {
        return { appId, result: 'skipped' };
      }
      return { appId, result: 'failed', error: error instanceof Error ? error.message : 'Failed' };
    }
  }

  private async classify(owned: readonly SteamOwnedGame[]): Promise<SteamClassification> {
    const [library, catalog] = await Promise.all([
      this.games.list(),
      this.games.listCatalogSteamGames(),
    ]);
    const known = new Set([
      ...library.flatMap((game) => (game.steamAppId ? [game.steamAppId] : [])),
      ...catalog.map((game) => game.steamAppId),
    ]);
    const pending = owned.map((game) => String(game.appid)).filter((appId) => !known.has(appId));
    const matches = new Map<string, number>();
    for (let start = 0; start < pending.length; start += IGDB_BATCH) {
      const found = await this.igdb.gamesBySteamApp(pending.slice(start, start + IGDB_BATCH));
      for (const [appId, igdbId] of found) matches.set(appId, igdbId);
    }
    return classifySteamGames(owned, library, catalog, matches);
  }

  private async steamIdOf(userId: number): Promise<string> {
    const steamId = (await this.settings.get(userId))?.steamId;
    if (!steamId) {
      throw ApiError.badRequest('steam_id_missing', 'Set your Steam account in the settings first');
    }
    return steamId;
  }

  private async owned(steamId: string): Promise<SteamOwnedGame[]> {
    let games: SteamOwnedGame[];
    try {
      games = await this.steam.ownedGames(steamId);
    } catch (error) {
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
        throw new ApiError(502, 'steam_key_rejected', 'Steam rejected the server API key');
      }
      throw new ApiError(502, 'steam_unavailable', 'Steam could not be reached');
    }
    if (games.length === 0) {
      throw new ApiError(
        422,
        'steam_profile_private',
        'Steam returned no games: the profile or its Game details are private, or the account owns none',
      );
    }
    return games;
  }
}
