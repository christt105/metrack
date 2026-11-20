import type { FetchFn } from '../../http/FetchFn.js';
import { getJson } from '../../http/getJson.js';
import type { SteamOwnedGame } from './SteamOwnedGame.js';

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
}
