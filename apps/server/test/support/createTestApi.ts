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
import { createImageStore } from '../../src/images/createImageStore.js';
import type { ImageStore } from '../../src/images/ImageStore.js';
import { MetadataCache } from '../../src/metadata/MetadataCache.js';
import { SqliteMetadataStateRepository } from '../../src/storage/sqlite/SqliteMetadataStateRepository.js';
import { movieLifecycle } from '../../src/metadata/movieLifecycle.js';
import { seriesLifecycle } from '../../src/metadata/seriesLifecycle.js';
import { SteamGridDbClient } from '../../src/providers/steamgriddb/SteamGridDbClient.js';
import { TmdbClient } from '../../src/providers/tmdb/TmdbClient.js';
import { TmdbMovieSource } from '../../src/providers/tmdb/TmdbMovieSource.js';
import { TmdbSeriesSource } from '../../src/providers/tmdb/TmdbSeriesSource.js';
import { PublishQueue } from '../../src/publish/PublishQueue.js';
import { MigrationRunner } from '../../src/storage/MigrationRunner.js';
import { migrations } from '../../src/storage/migrations/index.js';
import { openDatabase } from '../../src/storage/sqlite/openDatabase.js';
import { SqliteBookRepository } from '../../src/storage/sqlite/SqliteBookRepository.js';
import type { BookRepository } from '../../src/storage/repositories/BookRepository.js';
import { SqliteMovieRepository } from '../../src/storage/sqlite/SqliteMovieRepository.js';
import type { MovieRepository } from '../../src/storage/repositories/MovieRepository.js';
import { SqliteReleaseAlertRepository } from '../../src/storage/sqlite/SqliteReleaseAlertRepository.js';
import type { ReleaseAlertRepository } from '../../src/storage/repositories/ReleaseAlertRepository.js';
import { SqliteSeasonOverrideRepository } from '../../src/storage/sqlite/SqliteSeasonOverrideRepository.js';
import { SqliteSeasonRepository } from '../../src/storage/sqlite/SqliteSeasonRepository.js';
import type { SeasonRepository } from '../../src/storage/repositories/SeasonRepository.js';
import { SqliteSeriesRepository } from '../../src/storage/sqlite/SqliteSeriesRepository.js';
import type { SeriesRepository } from '../../src/storage/repositories/SeriesRepository.js';
import { SqliteUnlinkedTitleRepository } from '../../src/storage/sqlite/SqliteUnlinkedTitleRepository.js';
import type { UnlinkedTitleRepository } from '../../src/storage/repositories/UnlinkedTitleRepository.js';
import { SqliteVideogameRepository } from '../../src/storage/sqlite/SqliteVideogameRepository.js';
import type { VideogameRepository } from '../../src/storage/repositories/VideogameRepository.js';
import { TitleProviders } from '../../src/titles/TitleProviders.js';
import { TmdbMovieProvider } from '../../src/titles/TmdbMovieProvider.js';
import { TmdbSeriesProvider } from '../../src/titles/TmdbSeriesProvider.js';
import { WatchlistService } from '../../src/alerts/WatchlistService.js';
import { FakeScheduler } from './FakeScheduler.js';
import { signedInAs } from './signedInAs.js';

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

  const movies = new SqliteMovieRepository(db);
  const series = new SqliteSeriesRepository(db);
  const seasons = new SqliteSeasonRepository(db);
  const videogames = new SqliteVideogameRepository(db);
  const books = new SqliteBookRepository(db);
  const unlinked = new SqliteUnlinkedTitleRepository(db);
  const store = createImageStore(db, join(dir, 'images'), fetchFn);
  const states = new SqliteMetadataStateRepository(db);
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
    { notify: async () => true },
    { info: () => {}, error: () => {} },
    scheduler,
  );
  const alerts = new SqliteReleaseAlertRepository(db);
  const edit = createEditServices({
    sources: {
      movies,
      series,
      seasons,
      videogames,
      books,
      overrides: new SqliteSeasonOverrideRepository(db),
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
    authenticator: signedInAs(),
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
