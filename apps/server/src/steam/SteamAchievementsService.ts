import type {
  SteamAchievementsRequest,
  SteamAchievementsResponse,
  Videogame,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { SteamClient } from '../providers/steam/SteamClient.js';
import type { SteamPlayerAchievements } from '../providers/steam/SteamPlayerAchievements.js';
import type { UserSettingsRepository } from '../storage/repositories/UserSettingsRepository.js';
import type { VideogameRepository } from '../storage/repositories/VideogameRepository.js';
import { STEAM_ACHIEVEMENTS_BUDGET } from './SteamAchievementsBudget.js';

const MAX_PER_REQUEST = Math.floor(
  (STEAM_ACHIEVEMENTS_BUDGET.limit - STEAM_ACHIEVEMENTS_BUDGET.overhead) /
    STEAM_ACHIEVEMENTS_BUDGET.game,
);

function played(game: Videogame): number {
  return (game.timeSpentMinutes ?? 0) > 0 ? 1 : 0;
}

/**
 * Stores, for the games of the signed-in user that have a Steam app id, how many achievements Steam says they have and
 * how many the user unlocked. A game Steam says has no achievements is stored with a total of 0; a game Steam could
 * not answer for keeps its previous counts, so unknown is never turned into "0 of N" nor into a complete game.
 */
export class SteamAchievementsService {
  constructor(
    private readonly steam: SteamClient,
    private readonly games: VideogameRepository,
    private readonly settings: UserSettingsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Checks the next games of a pass, as many as fit in `STEAM_ACHIEVEMENTS_BUDGET`: games with playtime first, then
   * games never checked, then the least recently checked. A pass is the games not checked since its `asOf`, which
   * the first request creates and every answer returns; every game asked is stamped, answered or not, so a pass
   * always ends. Call it again until `remaining` is 0.
   */
  async refresh(
    userId: number,
    request: SteamAchievementsRequest,
  ): Promise<SteamAchievementsResponse> {
    const steamId = (await this.settings.get(userId))?.steamId;
    if (!steamId) {
      throw ApiError.badRequest('steam_id_missing', 'Set your Steam account in the settings first');
    }
    const asOf = request.asOf ?? this.now().toISOString();
    if (Number.isNaN(Date.parse(asOf))) {
      throw ApiError.badRequest('invalid_as_of', 'asOf must be a date and time');
    }
    const linked = (await this.games.list()).filter((game) => game.steamAppId !== null);
    let pending: Videogame[];
    if (request.gameId !== undefined) {
      const game = linked.find((candidate) => candidate.id === request.gameId);
      if (!game) throw ApiError.notFound('Game not found or without a Steam app id');
      pending = [game];
    } else {
      pending = linked
        .filter((game) => game.achievementsCheckedAt === null || game.achievementsCheckedAt < asOf)
        .sort(
          (a, b) =>
            played(b) - played(a) ||
            (a.achievementsCheckedAt ?? '').localeCompare(b.achievementsCheckedAt ?? '') ||
            a.id - b.id,
        );
    }
    const batch = pending.slice(0, MAX_PER_REQUEST);
    let failed = 0;
    for (const game of batch) {
      if (!(await this.check(steamId, game))) failed += 1;
    }
    return {
      processed: batch.length,
      failed,
      remaining: pending.length - batch.length,
      asOf,
    };
  }

  private async check(steamId: string, game: Videogame): Promise<boolean> {
    const checkedAt = this.now().toISOString();
    let found: SteamPlayerAchievements | undefined;
    try {
      found = await this.steam.playerAchievements(steamId, game.steamAppId as string);
    } catch {
      found = undefined;
    }
    if (!found) {
      await this.games.update(game.id, { achievementsCheckedAt: checkedAt });
      return false;
    }
    await this.games.update(game.id, {
      achievementsUnlocked: found.unlocked,
      achievementsTotal: found.total,
      achievementsLastUnlockedAt:
        found.lastUnlockTime === null
          ? null
          : new Date(found.lastUnlockTime * 1000).toISOString().slice(0, 10),
      achievementsCheckedAt: checkedAt,
    });
    return true;
  }
}
