import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { TmdbClient } from '../src/providers/tmdb/TmdbClient.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openDatabase } from '../src/storage/sqlite/openDatabase.js';
import { SqliteEpisodeWatchRepository } from '../src/storage/sqlite/SqliteEpisodeWatchRepository.js';
import { SqliteMovieRepository } from '../src/storage/sqlite/SqliteMovieRepository.js';
import { SqliteSeasonOverrideRepository } from '../src/storage/sqlite/SqliteSeasonOverrideRepository.js';
import { SqliteSeasonRepository } from '../src/storage/sqlite/SqliteSeasonRepository.js';
import { SqliteSeriesRepository } from '../src/storage/sqlite/SqliteSeriesRepository.js';
import { SqliteTransactionRunner } from '../src/storage/sqlite/SqliteTransactionRunner.js';
import { SqliteUnlinkedTitleRepository } from '../src/storage/sqlite/SqliteUnlinkedTitleRepository.js';
import { SeriesIndexBuilder } from '../src/sync/SeriesIndexBuilder.js';
import { SyncApplier } from '../src/sync/SyncApplier.js';
import { SyncService } from '../src/sync/SyncService.js';
import { TvdbEpisodeIdCache } from '../src/sync/TvdbEpisodeIdCache.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import { pathFetch } from './support/pathFetch.js';

const API = 'https://api.themoviedb.org/3';
const GROUP = 'group1';
const TVDB_BASE = 9000;

const ep = (id: number, order: number, season: number, airDate: string) => ({
  id,
  name: `E${id}`,
  season_number: season,
  episode_number: order + 1,
  air_date: airDate,
  order,
});

function tmdbRoutes(): Record<string, object> {
  const routes: Record<string, object> = {
    [`${API}/tv/95479/episode_groups`]: { results: [] },
    [`${API}/tv/episode_group/${GROUP}`]: {
      id: GROUP,
      name: 'Seasons',
      type: 6,
      groups: [
        {
          id: 'a',
          name: 'Season 1',
          order: 1,
          episodes: [ep(100, 0, 1, '2020-10-01'), ep(101, 1, 1, '2020-10-08')],
        },
        { id: 'b', name: 'Season 2', order: 2, episodes: [ep(200, 0, 1, '2023-07-06')] },
      ],
    },
    [`${API}/tv/95479`]: {
      id: 95479,
      seasons: [{ season_number: 1, name: 'Season 1', episode_count: 3 }],
      'season/1': {
        episodes: [
          { id: 100, name: 'E100', episode_number: 1, air_date: '2020-10-01' },
          { id: 101, name: 'E101', episode_number: 2, air_date: '2020-10-08' },
          { id: 200, name: 'E200', episode_number: 3, air_date: '2023-07-06' },
        ],
      },
    },
  };
  [100, 101, 200].forEach((id, i) => {
    routes[`${API}/find/${TVDB_BASE + i}`] = { tv_results: [], tv_episode_results: [{ id }] };
  });
  return routes;
}

const library = {
  load: async () => ({
    movies: [],
    series: [
      {
        jellyfinId: 'js',
        title: 'Jujutsu Kaisen',
        year: 2020,
        tmdbId: 95479,
        tvdbId: null,
        seasons: [
          {
            jellyfinId: 'js1',
            number: 1,
            title: null,
            episodes: [0, 1].map((i) => ({
              jellyfinId: `e${i}`,
              number: i + 1,
              airDate: i === 0 ? '2020-10-01' : '2020-10-08',
              runtimeSeconds: 1500,
              available: true,
              tvdbId: TVDB_BASE + i,
            })),
          },
          {
            jellyfinId: 'js2',
            number: 2,
            title: null,
            episodes: [
              {
                jellyfinId: 'e2',
                number: 1,
                airDate: '2023-07-06',
                runtimeSeconds: 1500,
                available: true,
                tvdbId: TVDB_BASE + 2,
              },
            ],
          },
        ],
      },
    ],
  }),
};

const plays = {
  listPlays: async () =>
    ['e0', 'e1', 'e2'].map((itemId) => ({
      itemId,
      playedAt: '2026-10-24T20:00:00.000Z',
      watchedSeconds: 1500,
      title: 'Jujutsu Kaisen',
    })),
};

async function setup(routes: Record<string, object>, group: string | null) {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-index-sync-'));
  const db = openDatabase(join(dir, 'metrack.db'));
  new MigrationRunner(db, migrations).run();
  const targets = {
    movies: new SqliteMovieRepository(db, OWNER_SCOPE),
    series: new SqliteSeriesRepository(db, OWNER_SCOPE),
    seasons: new SqliteSeasonRepository(db, OWNER_SCOPE),
    overrides: new SqliteSeasonOverrideRepository(db, OWNER_SCOPE),
    unlinked: new SqliteUnlinkedTitleRepository(db, OWNER_SCOPE),
    episodeWatches: new SqliteEpisodeWatchRepository(db, OWNER_SCOPE),
  };
  const series = await targets.series.create({
    ...emptySeries(),
    tmdbId: 95479,
    tmdbEpisodeGroup: group,
    title: 'Jujutsu Kaisen',
  });
  const first = await targets.seasons.create({
    ...emptySeason(),
    seriesId: series.id,
    number: 1,
    tmdbSeasonNumber: 1,
    episodeCount: group ? 2 : 3,
  });
  const net = pathFetch(routes);
  const tmdb = new TmdbClient(net.fetch, { apiKey: 'key', language: 'en-US' });
  const service = new SyncService(
    library,
    plays,
    new SeriesIndexBuilder(tmdb, new TvdbEpisodeIdCache(join(dir, 'ids.json'))),
    targets,
    new SyncApplier(new SqliteTransactionRunner(db), targets),
    { timeZone: 'UTC', now: () => new Date('2026-11-18T12:00:00Z') },
  );
  return { targets, service, series, first, net };
}

describe('syncing by TMDB episode id', () => {
  it('records the watches by TMDB id and creates the seasons of the episode group', async () => {
    const t = await setup(tmdbRoutes(), GROUP);
    const { result } = await t.service.apply();
    expect(result).toMatchObject({ seasonsCreated: 1, seasonsUpdated: 1 });
    expect(await t.targets.episodeWatches.get(t.series.id)).toEqual({
      '100': [{ startedAt: '2026-10-24', finishedAt: '2026-10-24' }],
      '101': [{ startedAt: '2026-10-24', finishedAt: '2026-10-24' }],
      '200': [{ startedAt: '2026-10-24', finishedAt: '2026-10-24' }],
    });
    const seasons = await t.targets.seasons.listBySeries(t.series.id);
    expect(
      seasons.map((s) => [s.number, s.tmdbSeasonNumber, s.status, s.watchedCount, s.startedAt]),
    ).toEqual([
      [1, 1, 'completed', 2, '2026-10-24'],
      [2, 2, 'completed', 1, '2026-10-24'],
    ]);
    expect(seasons[1]?.title).toBeNull();
  });

  it('records all three Jellyfin seasons in the single regular TMDB season, and is idempotent', async () => {
    const t = await setup(tmdbRoutes(), null);
    await t.service.apply();
    const seasons = await t.targets.seasons.listBySeries(t.series.id);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]).toMatchObject({ number: 1, status: 'completed', watchedCount: 3 });
    expect(Object.keys((await t.targets.episodeWatches.get(t.series.id)) ?? {}).sort()).toEqual([
      '100',
      '101',
      '200',
    ]);
    const again = await t.service.apply();
    expect(again.plan.series).toEqual([]);
  });

  it('keeps the Jellyfin numbering with fallback keys when TMDB cannot be read', async () => {
    const t = await setup({}, null);
    await t.service.apply();
    expect(Object.keys((await t.targets.episodeWatches.get(t.series.id)) ?? {}).sort()).toEqual([
      's1e1',
      's1e2',
      's2e1',
    ]);
  });
});
