import { describe, expect, it } from 'vitest';
import type { MovieChange, ConnectorSyncState, ConnectorUser } from '@metrack/domain';
import { connectorHarness } from './support/connectorHarness.js';

async function versionOf(
  call: (method: 'GET', url: string, secret: string) => Promise<{ json<T>(): T }>,
  secret: string,
  userId: number,
): Promise<number> {
  const response = await call('GET', `/api/connector/users/${userId}/sync-state`, secret);
  return response.json<ConnectorSyncState>().contentVersion;
}

const MATRIX: MovieChange = {
  action: 'create',
  movieId: null,
  jellyfinId: 'jf-matrix',
  tmdbId: 603,
  title: 'The Matrix',
  year: 1999,
  startedAt: '2026-01-01',
  finishedAt: '2026-01-01',
  rewatches: [],
  missingRating: true,
};

describe('connector token scope', () => {
  it('can only be created by the owner', async () => {
    const { app, cookieFor, createToken } = await connectorHarness();
    const refused = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: { cookie: await cookieFor(2) },
      payload: { name: 'sneaky', scope: 'connector', expiresInDays: null },
    });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'owner_only' });
    expect((await createToken(1, 'connector')).token.scope).toBe('connector');
  });

  it('is refused on every route outside /api/connector', async () => {
    const { createToken, call } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    for (const [method, url] of [
      ['GET', '/api/auth/me'],
      ['GET', '/api/sync/report'],
      ['POST', '/api/sync/apply'],
    ] as const) {
      const response = await call(method, url, secret);
      expect(response.statusCode, url).toBe(403);
      expect(response.json()).toMatchObject({ code: 'connector_token_only' });
    }
  });

  it('needs a token: a browser session gets 403 on /api/connector', async () => {
    const { app, cookieFor } = await connectorHarness();
    const response = await app.inject({
      method: 'GET',
      url: '/api/connector/users',
      headers: { cookie: await cookieFor(1) },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'token_required' });
  });
});

describe('GET /api/connector/users', () => {
  it('lists every user with a Jellyfin account to a connector token', async () => {
    const { createToken, call } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    const response = await call('GET', '/api/connector/users', secret);
    expect(response.json<ConnectorUser[]>()).toEqual([
      { id: 1, name: expect.any(String), jellyfinUser: 'owner-jf' },
      { id: 2, name: 'Friend', jellyfinUser: 'friend-jf' },
    ]);
  });

  it('lists only the own user to a write token', async () => {
    const { createToken, call } = await connectorHarness();
    const { secret } = await createToken(2, 'write');
    const response = await call('GET', '/api/connector/users', secret);
    expect(response.json<ConnectorUser[]>().map((user) => user.id)).toEqual([2]);
  });
});

describe('/api/connector/users/{id}', () => {
  it('lets a write token act only on its own user', async () => {
    const { createToken, call } = await connectorHarness();
    const { secret } = await createToken(2, 'write');
    expect((await call('GET', '/api/connector/users/2/sync-state', secret)).statusCode).toBe(200);
    const other = await call('GET', '/api/connector/users/1/sync-state', secret);
    expect(other.statusCode).toBe(403);
    expect(other.json()).toMatchObject({ code: 'connector_other_user' });
  });

  it('refuses a read token to write', async () => {
    const { createToken, call, syncBody } = await connectorHarness();
    const { secret } = await createToken(2, 'read');
    const response = await call('POST', '/api/connector/users/2/sync', secret, syncBody(0, {}));
    expect(response.statusCode).toBe(403);
  });

  it('answers 404 for a user without a Jellyfin account', async () => {
    const { createToken, call } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    expect((await call('GET', '/api/connector/users/3/sync-state', secret)).statusCode).toBe(404);
    expect((await call('GET', '/api/connector/users/99/sync-state', secret)).statusCode).toBe(404);
  });

  it('reads the state and content version of the user it names', async () => {
    const { createToken, call, versions } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    await versions.bump(2);
    const response = await call('GET', '/api/connector/users/2/sync-state', secret);
    const body = response.json<ConnectorSyncState>();
    expect(body.contentVersion).toBe(1);
    expect(body.state).toEqual({
      movies: [],
      series: [],
      seasons: [],
      overrides: [],
      unlinked: [],
    });
  });
});

describe('POST /api/connector/users/{id}/sync', () => {
  it('writes the plan for the user it names, not the owner, and bumps only their version', async () => {
    const { createToken, call, syncBody, versions } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    const ownerBefore = await versions.current(1);
    const response = await call(
      'POST',
      '/api/connector/users/2/sync',
      secret,
      syncBody(0, { movies: [MATRIX] }),
    );
    expect(response.statusCode).toBe(200);
    const body = response.json<{ result: { moviesCreated: number }; created: unknown[] }>();
    expect(body.result.moviesCreated).toBe(1);
    expect(body.created).toEqual([{ type: 'movie', id: expect.any(Number) }]);
    const state = (
      await call('GET', '/api/connector/users/2/sync-state', secret)
    ).json<ConnectorSyncState>();
    expect(state.state.movies.map((movie) => movie.title)).toEqual(['The Matrix']);
    expect(state.state.movies[0]).toMatchObject({
      jellyfinId: 'jf-matrix',
      status: 'completed',
      pendingReview: true,
    });
    const owner = (
      await call('GET', '/api/connector/users/1/sync-state', secret)
    ).json<ConnectorSyncState>();
    expect(owner.state.movies).toEqual([]);
    expect(await versions.current(2)).toBe(1);
    expect(await versions.current(1)).toBe(ownerBefore);
  });

  it('answers 409 when the content version moved and writes nothing', async () => {
    const { createToken, call, syncBody, versions } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    await versions.bump(2);
    const response = await call(
      'POST',
      '/api/connector/users/2/sync',
      secret,
      syncBody(0, { movies: [MATRIX] }),
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'content_changed' });
    const state = (
      await call('GET', '/api/connector/users/2/sync-state', secret)
    ).json<ConnectorSyncState>();
    expect(state.state.movies).toEqual([]);
  });

  it('refuses a plan naming a movie of another user and writes nothing', async () => {
    const { createToken, call, syncBody } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    const first = await call('GET', '/api/connector/users/1/sync-state', secret);
    await call(
      'POST',
      '/api/connector/users/1/sync',
      secret,
      syncBody(first.json<ConnectorSyncState>().contentVersion, { movies: [MATRIX] }),
    );
    const ownerMovie = (
      await call('GET', '/api/connector/users/1/sync-state', secret)
    ).json<ConnectorSyncState>().state.movies[0]!;
    const { contentVersion } = (
      await call('GET', '/api/connector/users/2/sync-state', secret)
    ).json<ConnectorSyncState>();
    const response = await call(
      'POST',
      '/api/connector/users/2/sync',
      secret,
      syncBody(contentVersion, {
        movies: [{ ...MATRIX, action: 'complete', movieId: ownerMovie.id, title: 'Hijacked' }],
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'plan_foreign_id' });
    const after = (
      await call('GET', '/api/connector/users/1/sync-state', secret)
    ).json<ConnectorSyncState>();
    expect(after.state.movies[0]?.title).toBe('The Matrix');
  });

  it('refuses a season that belongs to another series of the user', async () => {
    const { createToken, call, syncBody } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    const season = {
      seasonId: 1,
      jellyfinSeasonId: 's1',
      number: 1,
      tmdbSeasonNumber: 1,
      title: null,
      firstAirDate: null,
      episodeCount: 1,
      status: 'completed',
      startedAt: null,
      finishedAt: null,
      completes: true,
    };
    const response = await call(
      'POST',
      '/api/connector/users/1/sync',
      secret,
      syncBody(await versionOf(call, secret, 1), {
        series: [
          {
            seriesId: null,
            jellyfinId: 'x',
            tmdbId: 1,
            tvdbId: null,
            title: 'X',
            seasons: [season],
          },
        ],
      } as never),
    );
    expect(response.statusCode).toBe(400);
  });

  it('rejects a malformed plan', async () => {
    const { createToken, call } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    const response = await call('POST', '/api/connector/users/1/sync', secret, {
      contentVersion: 0,
      plan: { movies: [{ title: 'x' }], series: [], unlinked: [] },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /api/connector/users/{id}/refresh/{type}/{titleId}', () => {
  it('answers 501 without a metadata source', async () => {
    const { createToken, call } = await connectorHarness();
    const { secret } = await createToken(1, 'connector');
    const response = await call('POST', '/api/connector/users/1/refresh/movie/1', secret);
    expect(response.statusCode).toBe(501);
  });
});
