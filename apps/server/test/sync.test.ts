import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './support/buildTestApp.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openDatabase } from '../src/storage/sqlite/openDatabase.js';
import { SqliteMovieRepository } from '../src/storage/sqlite/SqliteMovieRepository.js';
import { SqliteSeasonOverrideRepository } from '../src/storage/sqlite/SqliteSeasonOverrideRepository.js';
import { SqliteSeasonRepository } from '../src/storage/sqlite/SqliteSeasonRepository.js';
import { SqliteSeriesRepository } from '../src/storage/sqlite/SqliteSeriesRepository.js';
import { SqliteUnlinkedTitleRepository } from '../src/storage/sqlite/SqliteUnlinkedTitleRepository.js';
import { JellyfinClient } from '../src/sync/jellyfin/JellyfinClient.js';
import type { JellyfinItem } from '../src/sync/jellyfin/JellyfinItem.js';
import { JellyfinLibrarySource } from '../src/sync/jellyfin/JellyfinLibrarySource.js';
import { PostgresPlaybackSource } from '../src/sync/jellystat/PostgresPlaybackSource.js';
import { createSyncQueue } from '../src/sync/createSyncQueue.js';
import { loadSyncConfig } from '../src/sync/loadSyncConfig.js';
import { PublishQueue } from '../src/publish/PublishQueue.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { SyncApplier } from '../src/sync/SyncApplier.js';
import { SyncService } from '../src/sync/SyncService.js';
import type { LibrarySource } from '../src/sync/LibrarySource.js';
import type { PlaybackSource } from '../src/sync/PlaybackSource.js';
import { formatSyncReport } from '../src/sync/formatSyncReport.js';
import { TvdbResolvingLibrarySource } from '../src/sync/TvdbResolvingLibrarySource.js';
import type { EntityRef } from '@metrack/domain';
import { TmdbClient } from '../src/providers/tmdb/TmdbClient.js';
import { SqliteTransactionRunner } from '../src/storage/sqlite/SqliteTransactionRunner.js';
import { signedInAs } from './support/signedInAs.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import { ownerQueues } from './support/ownerQueues.js';
import { SqliteUserSettingsRepository } from '../src/storage/sqlite/SqliteUserSettingsRepository.js';
import { UserSyncServices } from '../src/sync/UserSyncServices.js';
import { OWNER_ID } from '../src/users/OWNER_ID.js';
import { UserQueues } from '../src/users/UserQueues.js';
import { WebhookSecret } from '../src/api/WebhookSecret.js';

interface Recorded {
  url: URL;
  authorization: string | null;
}

function jellyfinFetch(handler: (url: URL) => JellyfinItem[], recorded: Recorded[] = []): FetchFn {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const headers = new Headers(init?.headers);
    recorded.push({ url, authorization: headers.get('authorization') });
    const items = handler(url);
    const start = Number(url.searchParams.get('StartIndex') ?? 0);
    const limit = Number(url.searchParams.get('Limit') ?? items.length);
    return Promise.resolve(
      Response.json({ Items: items.slice(start, start + limit), TotalRecordCount: items.length }),
    );
  }) as FetchFn;
}

const TICKS = 10_000_000;

describe('JellyfinClient', () => {
  it('sends only the MediaBrowser Authorization header', async () => {
    const recorded: Recorded[] = [];
    const client = new JellyfinClient(
      jellyfinFetch(() => [{ Id: 'a' }], recorded),
      { url: 'http://jf:8096/', token: 'secret' },
    );
    await client.listMovies();
    expect(recorded[0]?.authorization).toBe('MediaBrowser Token="secret"');
    const url = recorded[0]?.url;
    expect(`${url?.origin}${url?.pathname}`).toBe('http://jf:8096/Items');
    expect(url?.searchParams.get('IncludeItemTypes')).toBe('Movie');
    expect(url?.search).not.toContain('api_key');
  });

  function withUsers(users: { Id: string; Name: string }[], recorded: Recorded[] = []): FetchFn {
    const items = jellyfinFetch(() => [{ Id: 'a', UserData: { Played: true } }], recorded);
    return ((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      return url.pathname === '/Users' ? Promise.resolve(Response.json(users)) : items(input, init);
    }) as FetchFn;
  }

  it('reads the played state of the configured user', async () => {
    const recorded: Recorded[] = [];
    const client = new JellyfinClient(withUsers([{ Id: 'u1', Name: 'Admin' }], recorded), {
      url: 'http://jf',
      token: 't',
      userName: 'admin',
    });
    const movies = await client.listMovies();
    expect(movies[0]?.UserData?.Played).toBe(true);
    const itemsCall = recorded.find((call) => call.url.pathname === '/Items');
    expect(itemsCall?.url.searchParams.get('UserId')).toBe('u1');
  });

  it('fails clearly when the configured user does not exist', async () => {
    const client = new JellyfinClient(withUsers([{ Id: 'u1', Name: 'Admin' }]), {
      url: 'http://jf',
      token: 't',
      userName: 'ghost',
    });
    await expect(client.listMovies()).rejects.toThrow('Jellyfin user not found: ghost');
  });

  it('pages through every item', async () => {
    const all = Array.from({ length: 1100 }, (_, i) => ({ Id: `m${i}` }));
    const client = new JellyfinClient(
      jellyfinFetch(() => all),
      { url: 'http://jf', token: 't' },
    );
    expect(await client.listMovies()).toHaveLength(1100);
  });
});

describe('JellyfinLibrarySource', () => {
  const handler = (url: URL): JellyfinItem[] => {
    const type = url.searchParams.get('IncludeItemTypes');
    if (type === 'Movie') {
      return [
        {
          Id: 'm1',
          Name: 'Movie',
          ProductionYear: 2020,
          RunTimeTicks: 6000 * TICKS,
          ProviderIds: { Tmdb: '10' },
        },
        { Id: 'm2', Name: 'No id', ProviderIds: {}, UserData: { Played: true } },
      ];
    }
    if (type === 'Series') {
      return [
        { Id: 's1', Name: 'Lupin', ProviderIds: { Tmdb: '96677', Tvdb: '375921', Imdb: 'tt1' } },
      ];
    }
    if (type === 'Season')
      return [
        { Id: 'sn4', Name: 'Temporada 4', IndexNumber: 4 },
        { Id: 'x', Name: 'Extras' },
      ];
    return [
      {
        Id: 'e1',
        SeasonId: 'sn4',
        IndexNumber: 1,
        PremiereDate: '2026-10-23T16:31:00.0000000Z',
        RunTimeTicks: 1500 * TICKS,
      },
      { Id: 'e2', SeasonId: 'sn4', IndexNumber: 2, LocationType: 'Virtual' },
    ];
  };

  it('maps ids, seasons and episodes', async () => {
    const source = new JellyfinLibrarySource(
      new JellyfinClient(jellyfinFetch(handler), { url: 'http://jf', token: 't' }),
    );
    const library = await source.load();
    expect(library.movies).toEqual([
      {
        jellyfinId: 'm1',
        title: 'Movie',
        year: 2020,
        tmdbId: 10,
        runtimeSeconds: 6000,
        played: false,
      },
      {
        jellyfinId: 'm2',
        title: 'No id',
        year: null,
        tmdbId: null,
        runtimeSeconds: null,
        played: true,
      },
    ]);
    expect(library.series).toEqual([
      {
        jellyfinId: 's1',
        title: 'Lupin',
        year: null,
        tmdbId: 96677,
        tvdbId: 375921,
        seasons: [
          {
            jellyfinId: 'sn4',
            number: 4,
            title: null,
            episodes: [
              {
                jellyfinId: 'e1',
                number: 1,
                airDate: '2026-10-23',
                runtimeSeconds: 1500,
                available: true,
                played: false,
              },
              {
                jellyfinId: 'e2',
                number: 2,
                airDate: null,
                runtimeSeconds: null,
                available: false,
                played: false,
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe('PostgresPlaybackSource', () => {
  it('queries one account read-only and maps rows', async () => {
    const calls: { text: string; values: unknown[] }[] = [];
    const source = new PostgresPlaybackSource(
      {
        query: async (text, values) => {
          calls.push({ text, values });
          return {
            rows: [
              {
                item_id: 'e1',
                title: 'Show',
                played_at: new Date('2026-10-24T20:00:00Z'),
                seconds: '1500',
              },
            ],
          };
        },
      },
      'admin',
    );
    expect(await source.listPlays()).toEqual([
      { itemId: 'e1', title: 'Show', playedAt: '2026-10-24T20:00:00.000Z', watchedSeconds: 1500 },
    ]);
    expect(calls[0]?.values).toEqual(['admin']);
    expect(calls[0]?.text).toMatch(/^\s*SELECT/);
    expect(calls[0]?.text).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
  });
});

describe('loadSyncConfig', () => {
  it('stays off and names what is missing', () => {
    expect(loadSyncConfig({ JELLYFIN_URL: 'x' }).missing).toEqual([
      'JELLYFIN_TOKEN',
      'JELLYSTAT_DB_HOST',
      'JELLYSTAT_DB_PASSWORD',
    ]);
  });

  it('reads settings with defaults', () => {
    const { config } = loadSyncConfig({
      JELLYFIN_URL: 'http://jf',
      JELLYFIN_TOKEN: 't',
      JELLYSTAT_DB_HOST: 'db',
      JELLYSTAT_DB_PASSWORD: 'p',
    });
    expect(config).not.toHaveProperty('userName');
    expect(config).toMatchObject({
      timeZone: 'Europe/Madrid',
      jellystat: { port: 5432, user: 'postgres', database: 'jellystat' },
      webhookDelayMs: 120_000,
    });
  });

  it('reads the webhook secret and rejects a short one', () => {
    const env = {
      JELLYFIN_URL: 'http://jf',
      JELLYFIN_TOKEN: 't',
      JELLYSTAT_DB_HOST: 'db',
      JELLYSTAT_DB_PASSWORD: 'p',
    };
    expect(loadSyncConfig(env).config?.webhookSecret).toBeUndefined();
    expect(
      loadSyncConfig({ ...env, SYNC_WEBHOOK_SECRET: '' }).config?.webhookSecret,
    ).toBeUndefined();
    expect(
      loadSyncConfig({ ...env, SYNC_WEBHOOK_SECRET: 'a-long-enough-one' }).config?.webhookSecret,
    ).toBe('a-long-enough-one');
    expect(() => loadSyncConfig({ ...env, SYNC_WEBHOOK_SECRET: 'short' })).toThrow(
      'SYNC_WEBHOOK_SECRET',
    );
  });

  it('reads the webhook delay and rejects nonsense', () => {
    const env = {
      JELLYFIN_URL: 'http://jf',
      JELLYFIN_TOKEN: 't',
      JELLYSTAT_DB_HOST: 'db',
      JELLYSTAT_DB_PASSWORD: 'p',
    };
    expect(
      loadSyncConfig({ ...env, SYNC_WEBHOOK_DELAY_SECONDS: '30' }).config?.webhookDelayMs,
    ).toBe(30_000);
    expect(() => loadSyncConfig({ ...env, SYNC_WEBHOOK_DELAY_SECONDS: 'soon' })).toThrow(
      'SYNC_WEBHOOK_DELAY_SECONDS',
    );
    expect(() => loadSyncConfig({ ...env, SYNC_WEBHOOK_DELAY_SECONDS: '-1' })).toThrow(
      'SYNC_WEBHOOK_DELAY_SECONDS',
    );
  });
});

function setup(library: LibrarySource, plays: PlaybackSource) {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-sync-'));
  const db = openDatabase(join(dir, 'metrack.db'));
  const runner = new MigrationRunner(db, migrations);
  runner.run();
  const targets = {
    movies: new SqliteMovieRepository(db, OWNER_SCOPE),
    series: new SqliteSeriesRepository(db, OWNER_SCOPE),
    seasons: new SqliteSeasonRepository(db, OWNER_SCOPE),
    overrides: new SqliteSeasonOverrideRepository(db, OWNER_SCOPE),
    unlinked: new SqliteUnlinkedTitleRepository(db, OWNER_SCOPE),
  };
  const service = new SyncService(
    library,
    plays,
    targets,
    new SyncApplier(new SqliteTransactionRunner(db), targets),
    {
      timeZone: 'Europe/Madrid',
      now: () => new Date('2026-10-25T12:00:00Z'),
    },
  );
  db.prepare("INSERT INTO user_setting (user_id, jellyfin_user) VALUES (1, 'admin')").run();
  const services = new UserSyncServices(new SqliteUserSettingsRepository(db), () => service);
  return { db, runner, targets, service, services };
}

const lupinLibrary: LibrarySource = {
  load: async () => ({
    movies: [
      { jellyfinId: 'm1', title: 'Movie', year: 2020, tmdbId: 10, runtimeSeconds: 6000 },
      { jellyfinId: 'm2', title: 'Orphan', year: null, tmdbId: null, runtimeSeconds: null },
    ],
    series: [
      {
        jellyfinId: 's1',
        title: 'Lupin',
        year: 2021,
        tmdbId: 96677,
        tvdbId: 375921,
        seasons: [
          {
            jellyfinId: 'sn4',
            number: 4,
            title: null,
            episodes: ['e1', 'e2', 'e3'].map((id, i) => ({
              jellyfinId: id,
              number: i + 1,
              airDate: '2026-10-23',
              runtimeSeconds: 1500,
              available: true,
            })),
          },
        ],
      },
    ],
  }),
};
const lupinPlays: PlaybackSource = {
  listPlays: async () => [
    { itemId: 'm1', playedAt: '2026-10-20T20:00:00Z', watchedSeconds: 6000 },
    { itemId: 'm2', playedAt: '2026-10-21T20:00:00Z', watchedSeconds: 100 },
    ...['e1', 'e2', 'e3'].map((itemId, i) => ({
      itemId,
      playedAt: `2026-10-2${4 + i}T20:00:00Z`,
      watchedSeconds: 1500,
    })),
  ],
};

async function seedLupin(t: ReturnType<typeof setup>) {
  const series = await t.targets.series.create({
    tmdbId: 96677,
    tvdbId: 375921,
    jellyfinId: null,
    title: 'Lupin',
    originalTitle: null,
    firstAirDate: null,
    overview: null,
    genres: [],
    cast: [],
    follow: false,
    note: 'my note',
    slug: null,
    tags: [],
    review: 'series review',
    cover: null,
    banner: null,
  });
  const season = await t.targets.seasons.create({
    seriesId: series.id,
    number: 3,
    tmdbSeasonNumber: 3,
    jellyfinId: null,
    title: null,
    overview: null,
    firstAirDate: '2026-10-23',
    episodeCount: 8,
    slug: null,
    tags: [],
    cover: null,
    banner: null,
    status: 'planned',
    startedAt: null,
    finishedAt: null,
    rating: 9,
    review: 'season review',
    rewatches: [],
    pendingReview: false,
  });
  return { series, season };
}

describe('SyncService', () => {
  it('reports without writing anything', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    const { season } = await seedLupin(t);
    const plan = await t.service.report();
    expect(plan.movies).toHaveLength(1);
    expect(plan.unlinked).toHaveLength(1);
    expect(await t.targets.seasons.get(season.id)).toMatchObject({ number: 3, status: 'planned' });
    expect(await t.targets.movies.list()).toEqual([]);
    expect(await t.targets.unlinked.list()).toEqual([]);
    expect(formatSyncReport(plan, false)).toContain('nothing was written');
    t.db.close();
  });

  it('applies the plan, leaves notes and ratings alone, and is idempotent', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    const { season, series } = await seedLupin(t);
    const { result } = await t.service.apply();
    expect(result).toMatchObject({
      moviesCreated: 1,
      seriesUpdated: 1,
      seasonsUpdated: 1,
      unlinkedAdded: 1,
    });

    expect(await t.targets.seasons.get(season.id)).toMatchObject({
      number: 4,
      tmdbSeasonNumber: 3,
      jellyfinId: 'sn4',
      episodeCount: 3,
      status: 'completed',
      startedAt: '2026-10-24',
      finishedAt: '2026-10-26',
      rating: 9,
      review: 'season review',
    });
    expect(await t.targets.series.get(series.id)).toMatchObject({
      jellyfinId: 's1',
      note: 'my note',
      review: 'series review',
    });
    expect((await t.targets.movies.list())[0]).toMatchObject({
      tmdbId: 10,
      status: 'completed',
      finishedAt: '2026-10-20',
      rating: null,
    });
    expect((await t.targets.unlinked.list())[0]).toMatchObject({
      source: 'jellyfin',
      sourceRef: 'm2',
    });

    const again = await t.service.report();
    expect(again.movies).toEqual([]);
    expect(again.series).toEqual([]);
    expect(again.unlinked).toEqual([]);
    t.db.close();
  });

  it('marks the viewings it records as pending review', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    const { season } = await seedLupin(t);
    await t.service.apply();
    const movie = (await t.targets.movies.list())[0]!;
    expect(movie.pendingReview).toBe(true);
    expect((await t.targets.seasons.get(season.id))!.pendingReview).toBe(true);

    await t.targets.movies.update(movie.id, { pendingReview: false });
    await t.targets.seasons.update(season.id, { pendingReview: false });
    await t.service.apply();
    expect((await t.targets.movies.get(movie.id))!.pendingReview).toBe(false);
    expect((await t.targets.seasons.get(season.id))!.pendingReview).toBe(false);
    t.db.close();
  });

  it('leaves a season it only starts out of review', async () => {
    const firstEpisode: PlaybackSource = {
      listPlays: async () => [
        { itemId: 'e1', playedAt: '2026-10-24T20:00:00Z', watchedSeconds: 1500 },
      ],
    };
    const t = setup(lupinLibrary, firstEpisode);
    const { season } = await seedLupin(t);
    await t.service.apply();
    expect(await t.targets.seasons.get(season.id)).toMatchObject({
      status: 'in_progress',
      pendingReview: false,
    });
    t.db.close();
  });

  it('rolls back everything when a write fails', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    await seedLupin(t);
    await t.targets.movies.create({
      ...emptyMovieRow(),
      jellyfinId: 'm1',
      tmdbId: null,
      title: 'Clash',
    });
    t.targets.unlinked.create = () => {
      throw new Error('boom');
    };
    await expect(t.service.apply()).rejects.toThrow('boom');
    expect((await t.targets.seasons.list())[0]?.number).toBe(3);
    expect((await t.targets.movies.list()).map((m) => m.status)).toEqual(['planned']);
    t.db.close();
  });

  it('serves the report over HTTP and refuses apply without confirmation', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    await seedLupin(t);
    const app = buildTestApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: t.runner,
      sync: t.services,
    });
    const report = await app.inject({ method: 'GET', url: '/api/sync/report' });
    expect(report.statusCode).toBe(200);
    expect(report.json().movies).toHaveLength(1);
    const refused = await app.inject({ method: 'POST', url: '/api/sync/apply', payload: {} });
    expect(refused.statusCode).toBe(400);
    const refusedFalse = await app.inject({
      method: 'POST',
      url: '/api/sync/apply',
      payload: { confirm: false },
    });
    expect(refusedFalse.statusCode).toBe(400);
    expect(await t.targets.movies.list()).toEqual([]);
    const applied = await app.inject({
      method: 'POST',
      url: '/api/sync/apply',
      payload: { confirm: true },
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json().result.moviesCreated).toBe(1);
    t.db.close();
  });

  it('queues a delayed sync on a webhook, coalescing bursts, and refreshes the published site', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    await seedLupin(t);
    const scheduler = new FakeScheduler();
    const logs: string[] = [];
    const logger = {
      info: (m: string) => void logs.push(m),
      error: (m: string) => void logs.push(m),
    };
    const notifier = { notify: async () => true };
    const published = new PublishQueue(async () => 'published', notifier, logger, scheduler);
    const queue = createSyncQueue({
      services: t.services,
      userId: OWNER_ID,
      notifier,
      logger,
      scheduler,
      delayMs: 120_000,
      downstream: [ownerQueues(published), undefined],
    });
    const app = buildTestApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: t.runner,
      sync: t.services,
      syncQueues: ownerQueues(queue),
    });
    for (let i = 0; i < 3; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sync/webhook',
        payload: { NotificationType: 'PlaybackStop' },
      });
      expect(response.statusCode).toBe(202);
    }
    expect(scheduler.delays).toEqual([120_000]);
    expect(await t.targets.movies.list()).toEqual([]);

    await scheduler.fire();
    expect(await t.targets.movies.list()).toHaveLength(1);
    expect((await t.targets.movies.list())[0]).toMatchObject({ pendingReview: true });
    expect(logs.some((m) => m.includes('1 movies created'))).toBe(true);
    expect(scheduler.delays).toEqual([120_000, 5_000]);
    t.db.close();
  });

  it('needs the webhook secret, in the header or the query, when one is set', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    let marked = 0;
    const queues = new UserQueues(
      async () => [OWNER_ID],
      () => ({ markDirty: () => void (marked += 1) }) as unknown as PublishQueue,
    );
    const app = buildTestApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: t.runner,
      sync: t.services,
      syncQueues: queues,
      syncWebhookSecret: new WebhookSecret('s3cret-s3cret-s3cret'),
    });
    const post = (url: string, headers: Record<string, string> = {}) =>
      app.inject({ method: 'POST', url, headers, payload: {} });

    expect((await post('/api/sync/webhook')).statusCode).toBe(401);
    expect((await post('/api/sync/webhook?token=wrong')).statusCode).toBe(401);
    expect(
      (await post('/api/sync/webhook', { 'x-webhook-secret': 's3cret-s3cret-s3cre' })).statusCode,
    ).toBe(401);
    expect((await post('/api/sync/webhook')).json().code).toBe('bad_webhook_secret');
    expect(marked).toBe(0);

    expect(
      (await post('/api/sync/webhook', { 'x-webhook-secret': 's3cret-s3cret-s3cret' })).statusCode,
    ).toBe(202);
    expect((await post('/api/sync/webhook?token=s3cret-s3cret-s3cret')).statusCode).toBe(202);
    expect(marked).toBe(2);
    t.db.close();
  });

  it('answers 501 to a webhook when sync is not configured', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    const app = buildTestApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: t.runner,
    });
    const response = await app.inject({ method: 'POST', url: '/api/sync/webhook', payload: {} });
    expect(response.statusCode).toBe(501);
    t.db.close();
  });

  it('answers 501 when sync is not configured', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    const app = buildTestApp({
      appVersion: 'test',
      authenticator: signedInAs(),
      scope: OWNER_SCOPE,
      migrationRunner: t.runner,
    });
    const response = await app.inject({ method: 'GET', url: '/api/sync/report' });
    expect(response.statusCode).toBe(501);
    expect(response.json().code).toBe('sync_not_configured');
    t.db.close();
  });
});

describe('sync with TMDB', () => {
  const tvdbOnly: LibrarySource = {
    load: async () => {
      const library = await lupinLibrary.load();
      return { ...library, series: library.series.map((s) => ({ ...s, tmdbId: null, tvdbId: 1 })) };
    },
  };

  it('pairs series Jellyfin only knows by TheTVDB id through TMDB', async () => {
    const t = setup(
      new TvdbResolvingLibrarySource(tvdbOnly, async (id) => (id === 1 ? 96677 : null)),
      lupinPlays,
    );
    const { series } = await seedLupin(t);
    await t.targets.series.update(series.id, { tvdbId: null });
    const { result } = await t.service.apply();
    expect(result).toMatchObject({ seriesCreated: 0, seriesUpdated: 1 });
    expect(await t.targets.series.list()).toHaveLength(1);
    expect(await t.targets.series.get(series.id)).toMatchObject({
      tmdbId: 96677,
      tvdbId: 1,
      jellyfinId: 's1',
    });
    t.db.close();
  });

  it('keeps the TheTVDB id alone when the lookup fails', async () => {
    const source = new TvdbResolvingLibrarySource(tvdbOnly, () =>
      Promise.reject(new Error('down')),
    );
    const library = await source.load();
    expect(library.series[0]).toMatchObject({ tmdbId: null, tvdbId: 1 });
  });

  it('refreshes the titles it creates and ignores refresh failures', async () => {
    const t = setup(lupinLibrary, lupinPlays);
    const refreshed: EntityRef[] = [];
    const service = new SyncService(
      lupinLibrary,
      lupinPlays,
      t.targets,
      new SyncApplier(new SqliteTransactionRunner(t.db), t.targets),
      {
        timeZone: 'Europe/Madrid',
        now: () => new Date('2026-10-25T12:00:00Z'),
        refreshCreated: async (ref) => {
          refreshed.push(ref);
          if (ref.type === 'series') throw new Error('TMDB down');
        },
      },
    );
    const { result } = await service.apply();
    expect(result).toMatchObject({ moviesCreated: 1, seriesCreated: 1 });
    const movieId = (await t.targets.movies.list())[0]?.id;
    const seriesId = (await t.targets.series.list())[0]?.id;
    expect(refreshed).toEqual([
      { type: 'movie', id: movieId },
      { type: 'series', id: seriesId },
    ]);
    t.db.close();
  });

  it('asks TMDB for the series behind a TheTVDB id', async () => {
    const urls: string[] = [];
    const fetchFn = ((u: URL) => {
      urls.push(u.toString());
      return Promise.resolve(
        Response.json({ tv_results: u.pathname.endsWith('/7') ? [{ id: 42 }] : [] }),
      );
    }) as typeof fetch;
    const client = new TmdbClient(fetchFn, { apiKey: 'key', language: 'es-ES' });
    expect(await client.seriesIdForTvdb(7)).toBe(42);
    expect(await client.seriesIdForTvdb(8)).toBeNull();
    expect(urls[0]).toBe('https://api.themoviedb.org/3/find/7?external_source=tvdb_id&api_key=key');
  });
});

function emptyMovieRow() {
  return {
    tmdbId: null,
    jellyfinId: null,
    title: '',
    originalTitle: null,
    releaseDate: null,
    overview: null,
    genres: [],
    cast: [],
    director: null,
    follow: false,
    note: null,
    slug: null,
    tags: [],
    cover: null,
    banner: null,
    status: 'planned' as const,
    startedAt: null,
    finishedAt: null,
    rating: null,
    review: null,
    rewatches: [],
    pendingReview: false,
  };
}
