import type { FetchFn } from '../../http/FetchFn.js';
import { getJson } from '../../http/getJson.js';
import type { SteamGridDbImage } from './SteamGridDbImage.js';

const BASE = 'https://www.steamgriddb.com/api/v2';

/** Artwork lookup for games. Chosen images are downloaded through the image store. */
export class SteamGridDbClient {
  constructor(
    private readonly fetchFn: FetchFn,
    private readonly token: string,
  ) {}

  /** Community covers (`poster`, 600x900 grids) or banners (`backdrop`, wide heroes) for a game. */
  async images(gameId: number, kind: 'poster' | 'backdrop'): Promise<SteamGridDbImage[]> {
    const path = kind === 'poster' ? 'grids' : 'heroes';
    const dimensions = kind === 'poster' ? '600x900' : '1920x620,1600x650';
    const response = await getJson<{ data?: SteamGridDbImage[] }>(
      this.fetchFn,
      `${BASE}/${path}/game/${gameId}`,
      { dimensions },
      { Authorization: `Bearer ${this.token}` },
    );
    return response.data ?? [];
  }
}
