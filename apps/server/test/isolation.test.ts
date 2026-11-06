import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { emptyMovie } from '../src/media/emptyEntities.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { OWNER_ID } from '../src/users/OWNER_ID.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { pathFetch } from './support/pathFetch.js';
import { png } from './support/sampleImages.js';

const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/original';
const OWNER: User = { id: OWNER_ID, name: 'Owner', email: null };
const FRIEND: User = { id: 2, name: 'Friend', email: null };

/** Signs each request in as the user named by the `x-test-user` header. */
const byHeader: Authenticator = {
  userFor: async (headers) => {
    const id = Number(headers['x-test-user']);
    return [OWNER, FRIEND].find((user) => user.id === id);
  },
};

let api: TestApi;
let scope: AsyncUserScope;

beforeEach(async () => {
  scope = new AsyncUserScope();
  api = await createTestApi(
    pathFetch({
      [`${TMDB}/movie/603`]: {
        id: 603,
        title: 'Matrix',
        original_title: 'The Matrix',
        release_date: '1999-03-31',
        poster_path: '/p.jpg',
        genres: [{ name: 'Action' }],
      },
      [`${TMDB}/tv/1`]: {
        id: 1,
        name: 'Lupin',
        poster_path: '/lupin.jpg',
        seasons: [
          { season_number: 1, name: 'Part 1', episode_count: 5, air_date: '2021-01-08' },
          { season_number: 2, name: 'Part 2', episode_count: 5, air_date: '2021-06-11' },
        ],
      },
      [`${IMG}/p.jpg`]: png(500, 750, 1),
      [`${IMG}/lupin.jpg`]: png(500, 750, 2),
    }).fetch,
    { scope, authenticator: byHeader },
  );
  await new SqliteUserRepository(api.db).create({ name: FRIEND.name, email: null });
});

function as(user: User) {
  const headers = { 'x-test-user': String(user.id) };
  return {
    get: (url: string) => api.app.inject({ method: 'GET', url, headers }),
    post: (url: string, payload?: object) =>
      api.app.inject({ method: 'POST', url, headers, ...(payload ? { payload } : {}) }),
    patch: (url: string, payload: object) =>
      api.app.inject({ method: 'PATCH', url, headers, payload }),
    put: (url: string, payload?: object) =>
      api.app.inject({ method: 'PUT', url, headers, ...(payload ? { payload } : {}) }),
    delete: (url: string) => api.app.inject({ method: 'DELETE', url, headers }),
  };
}

const owner = as(OWNER);
const friend = as(FRIEND);

async function ownerMovie(): Promise<number> {
  const response = await owner.post('/api/movies', { title: 'Private film', status: 'completed' });
  expect(response.statusCode).toBe(201);
  return response.json().id;
}

describe('one user cannot reach what another stored', () => {
  it('hides a title from listing, reading and every write by id', async () => {
    const id = await ownerMovie();
    expect((await friend.get('/api/media')).json()).toEqual({ items: [], total: 0 });
    expect((await friend.get(`/api/movies/${id}`)).statusCode).toBe(404);
    expect((await friend.patch(`/api/movies/${id}`, { rating: 1 })).statusCode).toBe(404);
    expect(
      (await friend.post(`/api/movies/${id}/rewatches`, { date: '2026-01-01' })).statusCode,
    ).toBe(404);
    expect((await friend.delete(`/api/movies/${id}/rewatches/2026-01-01`)).statusCode).toBe(404);
    expect((await friend.delete(`/api/movies/${id}/edited/title`)).statusCode).toBe(404);
    expect((await friend.delete(`/api/movies/${id}/images/cover`)).statusCode).toBe(404);
    expect((await friend.put(`/api/watchlist/movies/${id}`)).statusCode).toBe(404);
    expect((await friend.post(`/api/metadata/movie/${id}/refresh`)).statusCode).toBe(404);
    expect((await friend.delete(`/api/movies/${id}`)).statusCode).toBe(404);

    const mine = (await owner.get(`/api/movies/${id}`)).json();
    expect(mine).toMatchObject({
      title: 'Private film',
      status: 'completed',
      rating: null,
      follow: false,
    });
    expect((await owner.get('/api/media')).json().total).toBe(1);
  });

  it('keeps the unlinked inbox, the watchlist and season overrides per user', async () => {
    await scope.run(OWNER_ID, () =>
      api.unlinked.create({
        mediaType: 'movie',
        title: 'Mystery',
        year: null,
        source: 'jellyfin',
        sourceRef: 'jf-1',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    );
    expect((await friend.get('/api/unlinked')).json()).toEqual([]);
    expect((await friend.delete('/api/unlinked/1')).statusCode).toBe(404);
    expect((await owner.get('/api/unlinked')).json()).toHaveLength(1);

    const added = await owner.post('/api/titles', { type: 'series', externalId: '1' });
    const seriesId = added.json().id;
    expect((await owner.put(`/api/watchlist/series/${seriesId}`)).statusCode).toBe(204);
    expect(
      (
        await owner.put(`/api/series/${seriesId}/overrides/2`, {
          number: 5,
          title: null,
          jellyfinSeasonId: null,
        })
      ).statusCode,
    ).toBe(200);
    expect((await friend.get('/api/watchlist')).json()).toEqual([]);
    expect((await friend.get(`/api/series/${seriesId}/overrides`)).statusCode).toBe(404);
    expect((await friend.delete(`/api/series/${seriesId}/overrides/2`)).statusCode).toBe(404);
    expect((await owner.get('/api/watchlist')).json()).toHaveLength(1);
  });

  it('keeps the right user on interleaved requests', async () => {
    const id = await ownerMovie();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? owner : friend).get(`/api/movies/${id}`)),
    );
    expect(results.map((r) => r.statusCode)).toEqual(
      Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 200 : 404)),
    );
  });

  it('refuses repository access with no user bound', async () => {
    await expect(api.movies.list()).rejects.toThrow('No user is bound');
  });
});

describe('the catalog is shared, the entry is personal', () => {
  it('reuses the catalog row when two users add the same title, with separate tracking and edits', async () => {
    const mine = await owner.post('/api/titles', { type: 'movie', externalId: '603' });
    const theirs = await friend.post('/api/titles', { type: 'movie', externalId: '603' });
    expect(theirs.statusCode).toBe(201);
    expect(theirs.json().id).toBe(mine.json().id);
    const id = mine.json().id as number;
    expect(api.db.prepare('SELECT COUNT(*) AS n FROM movie').get()?.n).toBe(1);

    await friend.patch(`/api/movies/${id}`, {
      status: 'completed',
      rating: 3,
      title: 'Matrix (friend)',
    });
    const ownerView = (await owner.get(`/api/movies/${id}`)).json();
    expect(ownerView).toMatchObject({
      title: 'Matrix',
      status: 'planned',
      rating: null,
      editedFields: [],
    });
    expect((await friend.get(`/api/movies/${id}`)).json()).toMatchObject({
      title: 'Matrix (friend)',
      rating: 3,
      editedFields: ['title'],
    });

    expect(
      (await friend.post('/api/titles', { type: 'movie', externalId: '603' })).statusCode,
    ).toBe(409);
  });

  it('refuses to change the external id of a title someone else has', async () => {
    const id = (await owner.post('/api/titles', { type: 'movie', externalId: '603' })).json().id;
    await friend.post('/api/titles', { type: 'movie', externalId: '603' });
    const response = await friend.patch(`/api/movies/${id}`, { tmdbId: 604 });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'catalog_shared',
      details: { fields: ['tmdb_id'] },
    });
    expect((await owner.get(`/api/movies/${id}`)).json().tmdbId).toBe(603);
  });

  it('lets a user change the external id of a title only they have', async () => {
    const id = await ownerMovie();
    expect((await owner.patch(`/api/movies/${id}`, { tmdbId: 42 })).json().tmdbId).toBe(42);
  });

  it('deletes only the entry while someone else still has the title, and the catalog row after', async () => {
    const id = (await owner.post('/api/titles', { type: 'series', externalId: '1' })).json().id;
    await friend.post('/api/titles', { type: 'series', externalId: '1' });
    const count = (table: string) =>
      Number(api.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n);
    expect([count('series'), count('season'), count('season_entry')]).toEqual([1, 2, 4]);

    expect((await friend.delete(`/api/series/${id}`)).statusCode).toBe(204);
    expect((await friend.get('/api/media')).json().total).toBe(0);
    expect([count('series'), count('season'), count('season_entry')]).toEqual([1, 2, 2]);
    expect((await owner.get(`/api/series/${id}`)).json().seasons).toHaveLength(2);

    expect((await owner.delete(`/api/series/${id}`)).statusCode).toBe(204);
    expect([count('series'), count('season'), count('season_entry')]).toEqual([0, 0, 0]);
  });
});

describe('instance-wide actions', () => {
  it('are only for the owner', async () => {
    for (const [method, url] of [
      ['POST', '/api/publish'],
      ['POST', '/api/images/cleanup'],
      ['DELETE', '/api/images/abc'],
      ['GET', '/api/sync/report'],
      ['POST', '/api/sync/apply'],
    ] as const) {
      const response = await api.app.inject({ method, url, headers: { 'x-test-user': '2' } });
      expect(response.statusCode, url).toBe(403);
      expect(response.json().code).toBe('owner_only');
    }
    expect((await owner.post('/api/publish')).statusCode).toBe(202);
  });
});

describe('repositories as the owner', () => {
  it('still work directly inside a bound scope', async () => {
    const created = await scope.run(OWNER_ID, () =>
      api.movies.create({ ...emptyMovie(), title: 'Direct' }),
    );
    expect((await owner.get(`/api/movies/${created.id}`)).json().title).toBe('Direct');
    expect((await friend.get(`/api/movies/${created.id}`)).statusCode).toBe(404);
  });
});
