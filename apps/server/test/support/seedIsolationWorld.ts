import { SqliteUserRepository } from '../../src/storage/sqlite/SqliteUserRepository.js';
import type { AsyncUserScope } from '../../src/users/AsyncUserScope.js';
import { OWNER_ID } from '../../src/users/OWNER_ID.js';
import type { TestApi } from './createTestApi.js';
import type { IsolationWorld } from './IsolationWorld.js';
import { insertSeason } from './insertSeason.js';
import { solidImage } from './sampleImages.js';

const OWNER_HEADERS = { 'x-test-user': String(OWNER_ID) };

/**
 * Gives user 1 (the owner) one of each owned resource and user 2 (trusted) a few of their own, so user 2 has
 * something to confuse with user 1's.
 */
export async function seedIsolationWorld(
  api: TestApi,
  scope: AsyncUserScope,
): Promise<IsolationWorld> {
  const users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Friend', email: null });
  await users.setRole(2, 'trusted');
  const send = async (
    method: 'POST' | 'PUT' | 'PATCH',
    url: string,
    payload?: unknown,
  ): Promise<{ id?: number }> => {
    const response = await api.app.inject({ method, url, headers: OWNER_HEADERS, payload });
    if (response.statusCode >= 300) throw new Error(`${method} ${url}: ${response.body}`);
    return response.body === '' ? {} : response.json();
  };

  const movie = await send('POST', '/api/movies', {
    title: 'U1 secret movie',
    status: 'completed',
  });
  await send('POST', `/api/movies/${movie.id}/rewatches`, { date: '2026-01-01' });
  const series = await send('POST', '/api/series', { title: 'U1 secret series' });
  const season = await insertSeason(
    api,
    series.id as number,
    { number: 1, episodeCount: 5 },
    { scope, userId: 1 },
  );
  await send('PATCH', `/api/seasons/${season.id}/episodes`, {
    op: 'mark',
    keys: ['s1e1'],
    date: '2026-02-02',
  });
  await send('PATCH', `/api/seasons/${season.id}`, { status: 'completed' });
  await send('POST', `/api/seasons/${season.id}/rewatches`, { date: '2026-01-01' });
  const game = await send('POST', '/api/games', { title: 'U1 secret game', status: 'completed' });
  const book = await send('POST', '/api/books', { title: 'U1 secret book', status: 'completed' });
  await send('PUT', `/api/watchlist/series/${series.id}`);
  const unlinked = await scope.run(OWNER_ID, () =>
    api.unlinked.create({
      mediaType: 'movie',
      title: 'U1 secret unlinked',
      year: null,
      source: 'jellyfin',
      sourceRef: 'jf-u1',
      createdAt: '2026-01-01T00:00:00Z',
    }),
  );
  const token = await api.tokens.create(OWNER_ID, {
    name: 'U1 secret token',
    scope: 'write',
    expiresInDays: null,
  });
  const invite = await api.invites.create({ maxUses: 3 });
  await send('PATCH', '/api/settings/public-page', {
    handle: 'u1handle',
    enabled: true,
    intro: 'U1 secret intro',
  });
  const image = await api.store.upload(await solidImage(40, 30), OWNER_ID, true);
  const imageHash = image.ref.slice(image.ref.lastIndexOf('/') + 1);
  const otherToken = await api.tokens.create(2, {
    name: 'U2 connector token',
    scope: 'write',
    expiresInDays: null,
  });

  return {
    movieId: movie.id as number,
    seriesId: series.id as number,
    seasonId: season.id,
    gameId: game.id as number,
    bookId: book.id as number,
    unlinkedId: unlinked.id,
    tokenId: token.token.id,
    inviteId: invite.invite.id,
    imageHash,
    markers: ['U1 secret', 'u1handle', token.secret, invite.code, imageHash],
    otherToken: otherToken.secret,
  };
}
