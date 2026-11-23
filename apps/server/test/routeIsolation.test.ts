import { beforeEach, describe, expect, it } from 'vitest';
import { ISOLATION_ADMIN_ONLY } from './support/ISOLATION_ADMIN_ONLY.js';
import { ISOLATION_ALLOWLIST } from './support/ISOLATION_ALLOWLIST.js';
import { ISOLATION_SELF_WRITES } from './support/ISOLATION_SELF_WRITES.js';
import type { IsolationRequest } from './support/IsolationRequest.js';
import type { IsolationWorld } from './support/IsolationWorld.js';
import { createIsolationApi } from './support/createIsolationApi.js';
import type { TestApi } from './support/createTestApi.js';
import { isolationPath } from './support/isolationPath.js';
import { readZip } from './support/readZip.js';
import { seedIsolationWorld } from './support/seedIsolationWorld.js';
import { snapshotIsolationWorld } from './support/snapshotIsolationWorld.js';

type Kind = 'allowlisted' | 'admin' | 'selfWrite' | 'byId' | 'list';

const LIST_QUERIES: Readonly<Record<string, string>> = {
  '/api/search': '?type=movie&q=U1%20secret',
};

let api: TestApi;
let world: IsolationWorld;

function kindOf(key: string): Kind | undefined {
  const path = key.slice(key.indexOf(' ') + 1);
  if (key in ISOLATION_ALLOWLIST) return 'allowlisted';
  if (key in ISOLATION_ADMIN_ONLY) return 'admin';
  if (key in ISOLATION_SELF_WRITES) return 'selfWrite';
  if (path.includes(':')) return 'byId';
  if (key.startsWith('GET ')) return 'list';
  return undefined;
}

function payloadFor(method: string, path: string): unknown {
  if (method === 'GET' || method === 'DELETE') return undefined;
  if (path.endsWith('/rewatches')) return { date: '2026-03-03' };
  if (path.endsWith('/images/:kind')) return { url: 'https://image.tmdb.org/t/p/original/x.jpg' };
  if (path === '/api/seasons/:id/episodes') return { op: 'mark', keys: ['s1e1'], date: null };
  if (path === '/api/series/:id/season-ordering') return { episodeGroup: null };
  if (path === '/api/seasons/:id/rewatch-intent') return { wanted: true };
  if (path === '/api/unlinked/:id/resolve') return { ids: { tmdbId: 1 } };
  if (path === '/api/users/:id/role') return { role: 'normal' };
  if (path.endsWith('/sync')) return { contentVersion: 1, plan: EMPTY_PLAN };
  if (path.endsWith('/seasons') && path.startsWith('/api/connector')) {
    return {
      seriesId: world.seriesId,
      today: '2026-03-05',
      release: {
        posterUrl: null,
        numberOfSeasons: 1,
        seasons: [],
        nextEpisode: null,
        flatrateEs: false,
      },
    };
  }
  if (path.endsWith('/release-alerts')) return { alerts: [] };
  if (path === '/api/series/:id') return { title: 'Hijacked' };
  if (method === 'PATCH') return { rating: 1 };
  return {};
}

const EMPTY_PLAN = {
  movies: [],
  series: [],
  unlinked: [],
  warnings: [],
  ignoredPlays: 0,
  unmatchedTitles: [],
};

function asUser2(request: IsolationRequest, contentType?: string) {
  const connector = request.url.startsWith('/api/connector');
  const headers: Record<string, string> = connector
    ? { authorization: `Bearer ${world.otherToken}` }
    : { 'x-test-user': '2' };
  if (contentType) headers['content-type'] = contentType;
  return api.app.inject({ ...request, headers });
}

function textOf(response: Awaited<ReturnType<typeof asUser2>>): string {
  const type = String(response.headers['content-type'] ?? '');
  if (!type.includes('zip')) return response.body;
  return [...readZip(response.rawPayload).values()].map((part) => part.toString('utf8')).join('\n');
}

const created = await createIsolationApi();
const keys = [
  ...new Set(
    created.api.app.routes
      .filter((route) => route.method !== 'ALL')
      .map((route) => `${route.method} ${route.path}`),
  ),
];
const routes = keys.map((key) => ({ key, kind: kindOf(key) }));

beforeEach(async () => {
  const fresh = await createIsolationApi();
  api = fresh.api;
  world = await seedIsolationWorld(fresh.api, fresh.scope);
});

describe('every registered route is covered by the isolation check', () => {
  it('has a decision for each route', () => {
    expect(
      routes.filter((route) => route.kind === undefined).map((route) => route.key),
      'add each of these to the isolation allowlist, admin list or self-write list, with a reason',
    ).toEqual([]);
  });

  it('has no stale entries in the allowlist, admin list or self-write list', () => {
    const known = new Set(keys);
    const listed = [
      ...Object.keys(ISOLATION_ALLOWLIST),
      ...Object.keys(ISOLATION_ADMIN_ONLY),
      ...Object.keys(ISOLATION_SELF_WRITES),
    ];
    expect(listed.filter((key) => !known.has(key))).toEqual([]);
  });

  it('sees the routes registered by every route module', () => {
    expect(created.api.app.routes.length).toBeGreaterThan(100);
    for (const key of [
      'GET /api/connector/users',
      'GET /api/auth/me',
      'GET /api/backups',
      'POST /api/settings/ntfy-topic',
      'DELETE /api/movies/:id',
    ]) {
      expect(keys).toContain(key);
    }
  });
});

describe('user 1 can reach what user 2 is refused', () => {
  it('owns the seeded data', async () => {
    const headers = { 'x-test-user': '1' };
    for (const url of [
      `/api/movies/${world.movieId}`,
      `/api/series/${world.seriesId}`,
      `/api/seasons/${world.seasonId}/episodes`,
      `/api/games/${world.gameId}`,
      `/api/books/${world.bookId}`,
      `/api/images/${world.imageHash}`,
    ]) {
      expect((await api.app.inject({ method: 'GET', url, headers })).statusCode, url).toBe(200);
    }
  });
});

describe.each(routes.filter((route) => route.kind && route.kind !== 'allowlisted'))(
  '$key',
  ({ key, kind }) => {
    const method = key.slice(0, key.indexOf(' ')) as IsolationRequest['method'];
    const pattern = key.slice(key.indexOf(' ') + 1);
    it(`as user 2 ${kind === 'byId' ? "with user 1's ids" : ''}`, async () => {
      const before = await snapshotIsolationWorld(api, world);
      if (kind === 'byId') {
        const response = await asUser2({
          method,
          url: isolationPath(pattern, world),
          payload: payloadFor(method, pattern),
        });
        expect([403, 404], response.body).toContain(response.statusCode);
      } else if (kind === 'admin') {
        const response = await asUser2({
          method,
          url: pattern,
          payload: ISOLATION_ADMIN_ONLY[key],
        });
        expect(response.statusCode, response.body).toBe(403);
      } else if (kind === 'selfWrite') {
        const write = ISOLATION_SELF_WRITES[key]!;
        const response = await asUser2(
          { method, url: pattern, payload: write.payload },
          write.contentType,
        );
        expect(write.statuses, response.body).toContain(response.statusCode);
      } else {
        const response = await asUser2({ method, url: `${pattern}${LIST_QUERIES[pattern] ?? ''}` });
        expect([200, 501], response.body).toContain(response.statusCode);
        const text = textOf(response);
        for (const marker of world.markers) expect(text).not.toContain(marker);
      }
      expect(await snapshotIsolationWorld(api, world)).toBe(before);
    });
  },
);
