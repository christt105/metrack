import type { FetchFn } from '../../http/FetchFn.js';
import { getJson } from '../../http/getJson.js';
import { HttpError } from '../../http/HttpError.js';
import type { SteamOwnedGame } from './SteamOwnedGame.js';
import type { SteamPlayerStats } from './SteamPlayerStats.js';
import type { SteamLanguage } from './SteamLanguage.js';
import type { SteamPlayerAchievement } from './SteamPlayerAchievement.js';
import type { SteamPlayerAchievements } from './SteamPlayerAchievements.js';
import type { SteamSchemaAchievement } from './SteamSchemaAchievement.js';
import { summarizeAchievements } from './summarizeAchievements.js';

const BASE = 'https://api.steampowered.com';

/**
 * Steam Web API. The key travels in the query string, as Steam requires, and never appears in an error: `getJson`
 * reports only the host and path of a failed request.
 */
export class SteamClient {
  constructor(
    private readonly fetchFn: FetchFn,
    private readonly apiKey: string,
  ) {}

  /**
   * Every game the account owns, free ones included. A private profile, or one whose game details are private,
   * is answered with an empty response, which is returned as an empty list.
   */
  async ownedGames(steamId: string): Promise<SteamOwnedGame[]> {
    const response = await getJson<{ response?: { games?: SteamOwnedGame[] } }>(
      this.fetchFn,
      `${BASE}/IPlayerService/GetOwnedGames/v1/`,
      {
        key: this.apiKey,
        steamid: steamId,
        include_appinfo: 1,
        include_played_free_games: 1,
        format: 'json',
      },
    );
    return response.response?.games ?? [];
  }

  /** The SteamID64 behind a vanity profile name, or null when no profile has it. */
  async resolveVanity(name: string): Promise<string | null> {
    const response = await getJson<{ response?: { success?: number; steamid?: string } }>(
      this.fetchFn,
      `${BASE}/ISteamUser/ResolveVanityURL/v1/`,
      { key: this.apiKey, vanityurl: name, format: 'json' },
    );
    return response.response?.success === 1 && response.response.steamid
      ? response.response.steamid
      : null;
  }

  /**
   * The achievements of one game for a player, in a single request: the list holds every achievement of the game
   * with whether the player unlocked it, so the total needs no schema request. Steam answers a game without
   * achievements or stats ("Requested app has no stats") with a 400, which is returned as `total: 0`. Any other
   * failure, a private profile included, throws, so it is never mistaken for a game without achievements.
   */
  async playerAchievements(steamId: string, appId: string): Promise<SteamPlayerAchievements> {
    return summarizeAchievements(await this.achievementList(steamId, appId));
  }

  /**
   * The raw list behind `playerAchievements`, with the same failure rules. With a `language` Steam also answers the
   * display name and description of each achievement in it.
   */
  async achievementList(
    steamId: string,
    appId: string,
    language?: SteamLanguage,
  ): Promise<SteamPlayerAchievement[]> {
    const target = new URL(`${BASE}/ISteamUserStats/GetPlayerAchievements/v1/`);
    target.searchParams.set('key', this.apiKey);
    target.searchParams.set('steamid', steamId);
    target.searchParams.set('appid', appId);
    if (language) target.searchParams.set('l', language);
    const response = await this.fetchFn(target, { headers: { Accept: 'application/json' } });
    const stats = await readStats(response);
    if (stats?.error !== undefined && /no stats/i.test(stats.error)) return [];
    if (!response.ok || !stats || stats.success === false) {
      throw new HttpError(
        `Request failed (${response.status}) for ${target.origin}${target.pathname}`,
        response.status,
      );
    }
    return stats.achievements ?? [];
  }

  /** The achievements a game defines, with names, descriptions and icon addresses in `language`; empty for a game without any. */
  async achievementSchema(
    appId: string,
    language: SteamLanguage,
  ): Promise<SteamSchemaAchievement[]> {
    const response = await getJson<{
      game?: { availableGameStats?: { achievements?: SteamSchemaAchievement[] } };
    }>(this.fetchFn, `${BASE}/ISteamUserStats/GetSchemaForGame/v2/`, {
      key: this.apiKey,
      appid: appId,
      l: language,
    });
    return response.game?.availableGameStats?.achievements ?? [];
  }
}

async function readStats(response: Response): Promise<SteamPlayerStats | undefined> {
  try {
    return ((await response.json()) as { playerstats?: SteamPlayerStats }).playerstats;
  } catch {
    return undefined;
  }
}
