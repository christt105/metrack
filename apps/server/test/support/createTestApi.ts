import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/buildApp.js';
import { createEditServices } from '../../src/api/createEditServices.js';
import type { ImageProvider } from '../../src/artwork/ImageProvider.js';
import { SteamGridDbImageProvider } from '../../src/artwork/SteamGridDbImageProvider.js';
import { TmdbImageProvider } from '../../src/artwork/TmdbImageProvider.js';
import type { FetchFn } from '../../src/http/FetchFn.js';
import { ImageStore } from '../../src/images/ImageStore.js';
import { MetadataCache } from '../../src/metadata/MetadataCache.js';
import { MetadataStateRepository } from '../../src/metadata/MetadataStateRepository.js';
import { movieLifecycle } from '../../src/metadata/movieLifecycle.js';
import { seriesLifecycle } from '../../src/metadata/seriesLifecycle.js';
import { SteamGridDbClient } from '../../src/providers/steamgriddb/SteamGridDbClient.js';
import { TmdbClient } from '../../src/providers/tmdb/TmdbClient.js';
import { TmdbMovieSource } from '../../src/providers/tmdb/TmdbMovieSource.js';
import { TmdbSeriesSource } from '../../src/providers/tmdb/TmdbSeriesSource.js';
import { PublishQueue } from '../../src/publish/PublishQueue.js';
import { MigrationRunner } from '../../src/storage/MigrationRunner.js';
import { migrations } from '../../src/storage/migrations/index.js';
import { openDatabase } from '../../src/storage/openDatabase.js';
import {
  BookRepository,
  MovieRepository,
  ReleaseAlertRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
  VideogameRepository,
} from '../../src/storage/repositories/index.js';
import { TitleProviders } from '../../src/titles/TitleProviders.js';
import { TmdbMovieProvider } from '../../src/titles/TmdbMovieProvider.js';
import { TmdbSeriesProvider } from '../../src/titles/TmdbSeriesProvider.js';
import { WatchlistService } from '../../src/alerts/WatchlistService.js';
import { FakeScheduler } from './FakeScheduler.js';

export const NOW = new Date('2026-03-05T12:00:00Z');

export interface TestApi {
  app: FastifyInstance;
  store: ImageStore;
  scheduler: FakeScheduler;
  movies: MovieRepository;
  series: SeriesRepository;
  seasons: SeasonRepository;
  videogames: VideogameRepository;
  books: BookRepository;
  unlinked: UnlinkedTitleRepository;
  cache: MetadataCache;
  alerts: ReleaseAlertRepository;
}

/** The full API over a temporary database file and a fake network. TMDB and SteamGridDB are always configured. */
export async function createTestApi(fetchFn: FetchFn): Promise<TestApi> {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-api-'));
  const db = openDatabase(join(dir, 'metrack.db'));
  const runner = new MigrationRunner(db, migrations);
  runner.run();

  const movies = new MovieRepository(db);
  const series = new SeriesRepository(db);
  const seasons = new SeasonRepository(db);
  const videogames = new VideogameRepository(db);
  const books = new BookRepository(db);
  const unlinked = new UnlinkedTitleRepository(db);
  const store = new ImageStore(db, join(dir, 'images'), fetchFn);
  const states = new MetadataStateRepository(db);
  const cache = new MetadataCache(states, store, undefined, () => NOW);
  const tmdb = new TmdbClient(fetchFn, { apiKey: 'key', language: 'es-ES' });
  cache.register('movie', {
    repository: movies,
    source: new TmdbMovieSource(tmdb),
    lifecycle: movieLifecycle,
  });
  cache.register('series', {
    repository: series,
    source: new TmdbSeriesSource(tmdb),
    lifecycle: seriesLifecycle,
  });
  const titleProviders = new TitleProviders();
  titleProviders.register(new TmdbMovieProvider(tmdb, movies, cache));
  titleProviders.register(new TmdbSeriesProvider(tmdb, series, seasons, cache, store));
  const imageProviders: ImageProvider[] = [
    new TmdbImageProvider(tmdb),
    new SteamGridDbImageProvider(new SteamGridDbClient(fetchFn, 'token')),
  ];

  const scheduler = new FakeScheduler();
  const queue = new PublishQueue(
    async () => 'published',
    { notify: async () => {} },
    { info: () => {}, error: () => {} },
    scheduler,
  );
  const alerts = new ReleaseAlertRepository(db);
  const edit = createEditServices({
    sources: {
      movies,
      series,
      seasons,
      videogames,
      books,
      overrides: new SeasonOverrideRepository(db),
    },
    unlinked,
    states,
    images: store,
    cache,
    titleProviders,
    imageProviders,
    now: () => NOW,
  });
  const app = await buildApp({
    appVersion: 'test',
    migrationRunner: runner,
    imageStore: store,
    metadataCache: cache,
    publishQueue: queue,
    edit,
    watch: { watchlist: new WatchlistService(edit.editor, movies, series, seasons), alerts },
  });
  return {
    app,
    store,
    scheduler,
    movies,
    series,
    seasons,
    videogames,
    books,
    unlinked,
    cache,
    alerts,
  };
}
