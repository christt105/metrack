import { describe, expect, it } from 'vitest';
import type { ConnectorSyncState, ConnectorUser } from '@metrack/domain';
import { CloudClient } from '../src/connector/CloudClient.js';
import { CloudError } from '../src/connector/CloudError.js';
import { UserSync } from '../src/connector/UserSync.js';
import { describeUserSync } from '../src/connector/describeUserSync.js';
import { emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import type { SyncSources } from '../src/sync/SyncSources.js';
import { connectorHarness } from './support/connectorHarness.js';

const BASE = 'http://cloud.test';
const FRIEND: ConnectorUser = { id: 2, name: 'Friend', jellyfinUser: 'friend-jf' };

const sources: SyncSources = {
  library: {
    load: async () => ({
      movies: [
        {
          jellyfinId: 'jf1',
          title: 'The Matrix',
          year: 1999,
          tmdbId: 603,
          runtimeSeconds: 7200,
          played: true,
        },
      ],
      series: [],
    }),
  },
  playback: {
    listPlays: async () => [
      { itemId: 'jf1', playedAt: '2026-01-02T20:00:00Z', watchedSeconds: 7000 },
    ],
  },
};

async function setup(
  wrap?: (
    url: string,
    init: RequestInit | undefined,
    next: () => Response | Promise<Response>,
  ) => Promise<Response>,
  options: { metadata?: boolean } = {},
) {
  const harness = await connectorHarness(options);
  const { secret } = await harness.createToken(1, 'connector');
  const requests: string[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}`);
    const next = () => harness.app.request(url, init);
    return wrap ? wrap(url, init, next) : next();
  }) as typeof fetch;
  const errors: string[] = [];
  const logger = { info: () => {}, error: (message: string) => errors.push(message) };
  const cloud = new CloudClient(BASE, secret, fetchFn);
  const sync = new UserSync(
    cloud,
    () => sources,
    'Europe/Madrid',
    logger,
    () => new Date('2026-03-01T10:00:00Z'),
  );
  const stateOf = async (id: number) => (await cloud.syncState(id)) as ConnectorSyncState;
  return { ...harness, cloud, sync, requests, errors, stateOf, secret, fetchFn };
}

describe('UserSync against the home API', () => {
  it('computes the plan at home, applies it in the cloud and does nothing the second time', async () => {
    const { sync, stateOf, requests } = await setup();
    const first = await sync.run(FRIEND, true);
    expect(first.plan.movies.map((movie) => movie.action)).toEqual(['create']);
    expect(first.result).toMatchObject({ moviesCreated: 1 });
    expect(describeUserSync(first)).toContain('1 movies created');
    expect((await stateOf(2)).state.movies.map((movie) => movie.title)).toEqual(['The Matrix']);
    requests.length = 0;
    const second = await sync.run(FRIEND, true);
    expect(second.result).toBeUndefined();
    expect(requests).toEqual(['GET /api/connector/users/2/sync-state']);
  });

  it('writes nothing when it only reports', async () => {
    const { sync, stateOf, requests } = await setup();
    const outcome = await sync.run(FRIEND, false);
    expect(outcome.plan.movies).toHaveLength(1);
    expect((await stateOf(2)).state.movies).toEqual([]);
    expect(requests.some((request) => request.startsWith('POST'))).toBe(false);
  });

  it('reads the state again and recomputes the plan after a 409', async () => {
    let bumped = false;
    const { sync, requests, stateOf, versions } = await setup(async (url, init, next) => {
      if (!bumped && init?.method === 'POST' && url.endsWith('/sync')) {
        bumped = true;
        await versions.bump(2);
      }
      return next();
    });
    const outcome = await sync.run(FRIEND, true);
    expect(outcome.result).toMatchObject({ moviesCreated: 1 });
    expect(requests.filter((request) => request.endsWith('/sync-state'))).toHaveLength(2);
    expect(requests.filter((request) => request.endsWith('/sync'))).toHaveLength(2);
    expect((await stateOf(2)).state.movies).toHaveLength(1);
  });

  it('gives up with the 409 after three plans', async () => {
    const { sync, requests, versions } = await setup(async (url, init, next) => {
      if (init?.method === 'POST' && url.endsWith('/sync')) await versions.bump(2);
      return next();
    });
    await expect(sync.run(FRIEND, true)).rejects.toMatchObject({ status: 409 });
    expect(requests.filter((request) => request.endsWith('/sync'))).toHaveLength(3);
  });

  it('fails with the status when the cloud answers 5xx', async () => {
    const { sync } = await setup(async () => new Response('{"error":"boom"}', { status: 503 }));
    const failure = await sync.run(FRIEND, true).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CloudError);
    expect(failure).toMatchObject({ status: 503 });
  });

  it('propagates a network failure so the queue retries', async () => {
    const { sync } = await setup(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(sync.run(FRIEND, true)).rejects.toThrow('fetch failed');
  });

  it('asks for the metadata of every created title and survives a failed one', async () => {
    const { sync, requests, errors } = await setup(async (url, init, next) =>
      url.includes('/refresh/') ? new Response('{"error":"boom"}', { status: 500 }) : next(),
    );
    const outcome = await sync.run(FRIEND, true);
    expect(outcome.created).toBe(1);
    expect(outcome.refreshed).toBe(0);
    expect(requests.filter((request) => request.includes('/refresh/movie/'))).toHaveLength(1);
    expect(errors[0]).toContain('Refreshing movie');
    expect(describeUserSync(outcome)).toContain('refreshed 0 of 1');
  });

  it('stops asking for metadata when the cloud has no source', async () => {
    const { sync, requests } = await setup();
    const outcome = await sync.run(FRIEND, true);
    expect(outcome.refreshed).toBe(0);
    expect(requests.filter((request) => request.includes('/refresh/'))).toHaveLength(1);
    expect(describeUserSync(outcome)).toContain('refreshed 0 of 1');
  });

  it('asks again on later syncs for the metadata a cut or a failure left out, even with nothing to write', async () => {
    let refreshDown = true;
    const { sync, requests, sources } = await setup(
      async (url, init, next) =>
        refreshDown && url.includes('/refresh/')
          ? new Response('{"error":"boom"}', { status: 500 })
          : next(),
      { metadata: true },
    );
    const first = await sync.run(FRIEND, true);
    expect(first).toMatchObject({ created: 1, unfetched: 0, refreshed: 0 });
    refreshDown = false;
    requests.length = 0;
    const second = await sync.run(FRIEND, true);
    expect(second).toMatchObject({ created: 0, unfetched: 1, refreshed: 1 });
    expect(second.result).toBeUndefined();
    expect(requests.filter((request) => request.includes('/refresh/movie/'))).toHaveLength(1);
    expect(sources.movie.fetched).toEqual(['The Matrix']);
    expect(describeUserSync(second)).toBe(
      'sync found nothing to write, refreshed 1 of 1 titles without metadata',
    );
    requests.length = 0;
    const third = await sync.run(FRIEND, true);
    expect(third).toMatchObject({ unfetched: 0, refreshed: 0 });
    expect(requests).toEqual(['GET /api/connector/users/2/sync-state']);
  });

  it('does not count a title the provider failed to fetch, and retries it next time', async () => {
    const { sync, sources, errors } = await setup(undefined, { metadata: true });
    sources.movie.failing.add('The Matrix');
    const first = await sync.run(FRIEND, true);
    expect(first).toMatchObject({ created: 1, refreshed: 0 });
    expect(errors[0]).toContain('provider down');
    sources.movie.failing.clear();
    expect(await sync.run(FRIEND, true)).toMatchObject({ unfetched: 1, refreshed: 1 });
  });

  it('only counts the titles without metadata in a report', async () => {
    const { sync, requests } = await setup(undefined, { metadata: true });
    await sync.run(FRIEND, false);
    expect(requests.some((request) => request.includes('/refresh/'))).toBe(false);
  });

  it('is refused for a user other than the personal token owner', async () => {
    const harness = await connectorHarness();
    const { secret } = await harness.createToken(2, 'write');
    const cloud = new CloudClient(BASE, secret, ((input: string, init?: RequestInit) =>
      harness.app.request(input, init)) as unknown as typeof fetch);
    const sync = new UserSync(cloud, () => sources, 'Europe/Madrid', {
      info: () => {},
      error: () => {},
    });
    await expect(
      sync.run({ id: 1, name: 'Owner', jellyfinUser: 'owner-jf' }, true),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect((await sync.run(FRIEND, true)).result).toMatchObject({ moviesCreated: 1 });
  });

  it('syncs a series other users have too without changing the shared catalog', async () => {
    const harness = await connectorHarness();
    const { scope, repositories } = harness;
    const seed = async (userId: number) =>
      scope.run(userId, async () => {
        const series = await repositories.series.create({
          ...emptySeries(),
          tmdbId: 209867,
          title: 'Frieren',
        });
        await repositories.seasons.create({
          ...emptySeason(),
          seriesId: series.id,
          number: 1,
          title: 'Temporada 1',
          episodeCount: 28,
        });
        return series.id;
      });
    const seriesId = await seed(1);
    expect(await seed(2)).toBe(seriesId);
    const episodes = ['f1', 'f2'].map((jellyfinId, i) => ({
      jellyfinId,
      number: i + 1,
      airDate: '2023-09-29',
      runtimeSeconds: 1500,
      available: true,
    }));
    const frieren: SyncSources = {
      library: {
        load: async () => ({
          movies: [],
          series: [
            {
              jellyfinId: 'jf-frieren',
              title: 'Frieren',
              year: 2023,
              tmdbId: 209867,
              tvdbId: 424536,
              seasons: [{ jellyfinId: 'jf-s1', number: 1, title: 'Season 1', episodes }],
            },
          ],
        }),
      },
      playback: {
        listPlays: async () => [
          { itemId: 'f1', playedAt: '2026-01-02T20:00:00Z', watchedSeconds: 1500 },
        ],
      },
    };
    const { secret } = await harness.createToken(1, 'connector');
    const cloud = new CloudClient(BASE, secret, ((input: string, init?: RequestInit) =>
      harness.app.request(input, init)) as unknown as typeof fetch);
    const sync = new UserSync(cloud, () => frieren, 'Europe/Madrid', {
      info: () => {},
      error: () => {},
    });

    const first = await sync.run(FRIEND, true);
    expect(first.result).toMatchObject({ seriesUpdated: 1, seasonsUpdated: 1 });
    const friendView = await scope.run(2, async () => ({
      series: await repositories.series.get(seriesId),
      seasons: await repositories.seasons.list(),
    }));
    expect(friendView.series).toMatchObject({ jellyfinId: 'jf-frieren', tvdbId: null });
    expect(friendView.seasons[0]).toMatchObject({
      jellyfinId: 'jf-s1',
      status: 'in_progress',
      episodeCount: 2,
      title: 'Temporada 1',
    });
    const ownerView = await scope.run(1, async () => ({
      series: await repositories.series.get(seriesId),
      seasons: await repositories.seasons.list(),
    }));
    expect(ownerView.series).toMatchObject({ jellyfinId: null, tvdbId: null });
    expect(ownerView.seasons[0]).toMatchObject({ status: 'planned', episodeCount: 28 });

    const second = await sync.run(FRIEND, true);
    expect(second.plan.series).toEqual([]);
    expect(second.result).toBeUndefined();
  });
});
