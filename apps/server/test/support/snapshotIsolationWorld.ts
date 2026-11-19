import { OWNER_ID } from '../../src/users/OWNER_ID.js';
import type { TestApi } from './createTestApi.js';
import type { IsolationWorld } from './IsolationWorld.js';

/** Everything user 1 can read about their own data, as one string, to compare before and after user 2 acts. */
export async function snapshotIsolationWorld(api: TestApi, world: IsolationWorld): Promise<string> {
  const urls = [
    '/api/media',
    `/api/movies/${world.movieId}`,
    `/api/series/${world.seriesId}`,
    `/api/seasons/${world.seasonId}`,
    `/api/seasons/${world.seasonId}/episodes`,
    `/api/games/${world.gameId}`,
    `/api/books/${world.bookId}`,
    '/api/unlinked',
    '/api/watchlist',
    '/api/tokens',
    '/api/invites',
    '/api/settings',
    '/api/account/export/data',
    `/api/images/${world.imageHash}`,
  ];
  const parts: string[] = [];
  for (const url of urls) {
    const response = await api.app.inject({
      method: 'GET',
      url,
      headers: { 'x-test-user': String(OWNER_ID) },
    });
    parts.push(`${url} ${response.statusCode} ${response.rawPayload.toString('base64')}`);
  }
  return parts.join('\n');
}
