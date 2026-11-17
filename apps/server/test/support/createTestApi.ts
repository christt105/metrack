import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTestApp } from './buildTestApp.js';
import type { TestApp } from './TestApp.js';
import { createEditServices } from '../../src/api/createEditServices.js';
import type { ImageProvider } from '../../src/artwork/ImageProvider.js';
import { SteamGridDbImageProvider } from '../../src/artwork/SteamGridDbImageProvider.js';
import { TmdbImageProvider } from '../../src/artwork/TmdbImageProvider.js';
import type { FetchFn } from '../../src/http/FetchFn.js';
import { createImageStore } from '../../src/images/createImageStore.js';
import type { ImageStore } from '../../src/images/ImageStore.js';
import type { ImageStoreOptions } from '../../src/images/ImageStoreOptions.js';
import type { ContentVersions } from '../../src/site/ContentVersions.js';
import { testUrlGuard } from './testUrlGuard.js';
import { MetadataCache } from '../../src/metadata/MetadataCache.js';
import { SqliteMetadataStateRepository } from '../../src/storage/sqlite/SqliteMetadataStateRepository.js';
import { movieLifecycle } from '../../src/metadata/movieLifecycle.js';
import { seriesLifecycle } from '../../src/metadata/seriesLifecycle.js';
import { SteamGridDbClient } from '../../src/providers/steamgriddb/SteamGridDbClient.js';
import { TmdbClient } from '../../src/providers/tmdb/TmdbClient.js';
import { TmdbMovieSource } from '../../src/providers/tmdb/TmdbMovieSource.js';
import { SeasonRefresher } from '../../src/seasons/SeasonRefresher.js';
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
import { SqliteEpisodeWatchRepository } from '../../src/storage/sqlite/SqliteEpisodeWatchRepository.js';
import { SqliteSeasonEpisodesRepository } from '../../src/storage/sqlite/SqliteSeasonEpisodesRepository.js';
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
import { ApiTokenService } from '../../src/auth/ApiTokenService.js';
import { AccountDeletionService } from '../../src/account/AccountDeletionService.js';
import { AccountExporter } from '../../src/account/AccountExporter.js';
import { SqliteAccountRepository } from '../../src/storage/sqlite/SqliteAccountRepository.js';
import { InviteService } from '../../src/invites/InviteService.js';
import { SqliteInviteRepository } from '../../src/storage/sqlite/SqliteInviteRepository.js';
import { SqliteApiTokenRepository } from '../../src/storage/sqlite/SqliteApiTokenRepository.js';
import { SqliteHandAddedCatalogRepository } from '../../src/storage/sqlite/SqliteHandAddedCatalogRepository.js';
import { WatchlistService } from '../../src/alerts/WatchlistService.js';
import { FakeScheduler } from './FakeScheduler.js';
import { ownerQueues } from './ownerQueues.js';
import { signedInAs } from './signedInAs.js';
import type { Authenticator } from '../../src/auth/Authenticator.js';
import type { UserScope } from '../../src/users/UserScope.js';
import type { DatabaseSync } from 'node:sqlite';
import { OWNER_SCOPE } from './ownerScope.js';
import { SqlitePublicProfileRepository } from '../../src/storage/sqlite/SqlitePublicProfileRepository.js';
import { SqliteUserRepository } from '../../src/storage/sqlite/SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from '../../src/storage/sqlite/SqliteUserSettingsRepository.js';

export const NOW = new Date('2026-03-05T12:00:00Z');

export interface TestApi {
  app: TestApp;
  db: DatabaseSync;
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
  /** The data directory of the test: its database, `images/` and `users/`. */
  dir: string;
  deletion: AccountDeletionService;
  invites: InviteService;
  tokens: ApiTokenService;
  /** What the account deletion service reads as the current time; move it to pass the grace period. */
  clock: { now: Date };
}

/** The full API over a temporary database file and a fake network. TMDB and SteamGridDB are always configured. */
export interface TestApiOptions {
  /** Defaults to always acting as the owner. */
  scope?: UserScope;
  /** Defaults to treating every request as the owner's. */
  authenticator?: Authenticator;
  /** Defaults to the real encoder and quota, with `testUrlGuard`. */
  images?: ImageStoreOptions;
  /** The configured `PUBLIC_URL`; defaults to none. */
  publicUrl?: string;
  /** Counted when set; the library list and the public pages revalidate by it. */
  contentVersions?: ContentVersions;
}

export async function createTestApi(
  fetchFn: FetchFn,
  options: TestApiOptions = {},
): Promise<TestApi> {
  const scope = options.scope ?? OWNER_SCOPE;
  const dir = mkdtempSync(join(tmpdir(), 'metrack-api-'));
  const db = openDatabase(join(dir, 'metrack.db'));
  const runner = new MigrationRunner(db, migrations);
  runner.run();

  const movies = new SqliteMovieRepository(db, scope);
  const series = new SqliteSeriesRepository(db, scope);
  const seasons = new SqliteSeasonRepository(db, scope);
  const videogames = new SqliteVideogameRepository(db, scope);
  const books = new SqliteBookRepository(db, scope);
  const unlinked = new SqliteUnlinkedTitleRepository(db, scope);
  const store = createImageStore(db, join(dir, 'images'), fetchFn, undefined, {
    urlGuard: testUrlGuard,
    ...options.images,
  });
  const states = new SqliteMetadataStateRepository(db, scope);
  const cache = new MetadataCache(states, store, undefined, () => NOW);
  const tmdb = new TmdbClient(fetchFn, { apiKey: 'key', language: 'es-ES' });
  cache.register('movie', {
    repository: movies,
    source: new TmdbMovieSource(tmdb),
    lifecycle: movieLifecycle,
  });
  cache.register('series', {
    repository: series,
    source: new TmdbSeriesSource(tmdb, new SeasonRefresher(tmdb, seasons, store)),
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
  const alerts = new SqliteReleaseAlertRepository(db, scope);
  const overrides = new SqliteSeasonOverrideRepository(db, scope);
  const edit = createEditServices({
    sources: {
      movies,
      series,
      seasons,
      videogames,
      books,
      overrides,
    },
    unlinked,
    states,
    images: store,
    cache,
    tmdb,
    seasonEpisodes: new SqliteSeasonEpisodesRepository(db),
    episodeWatches: new SqliteEpisodeWatchRepository(db, scope),
    titleProviders,
    imageProviders,
    now: () => NOW,
  });
  const profiles = new SqlitePublicProfileRepository(db);
  const users = new SqliteUserRepository(db);
  const settings = new SqliteUserSettingsRepository(db);
  const tokens = new ApiTokenService(new SqliteApiTokenRepository(db), users);
  const clock = { now: NOW };
  const deletion = new AccountDeletionService(
    new SqliteAccountRepository(db),
    users,
    store,
    dir,
    { info: () => {}, error: () => {} },
    () => clock.now,
  );
  const inviteRepository = new SqliteInviteRepository(db);
  const invites = new InviteService(inviteRepository, users, () => clock.now);
  const app = buildTestApp({
    appVersion: 'test',
    authenticator: options.authenticator ?? signedInAs(),
    tokens,
    scope,
    migrationRunner: runner,
    imageStore: store,
    metadataCache: cache,
    publishQueues: ownerQueues(queue),
    edit,
    ...(options.contentVersions ? { contentVersions: options.contentVersions } : {}),
    watch: { watchlist: new WatchlistService(edit.editor, movies, series, seasons), alerts },
    account: {
      serverZip: true,
      exporter: new AccountExporter(
        {
          users,
          settings,
          profiles,
          apiTokens: new SqliteApiTokenRepository(db),
          invites: inviteRepository,
          movies,
          series,
          seasons,
          videogames,
          books,
          overrides,
          episodeWatches: new SqliteEpisodeWatchRepository(db, scope),
          unlinked,
          releaseAlerts: alerts,
          images: store,
        },
        () => NOW,
      ),
      deletion,
      profiles,
      users,
    },
    invites,
    userAdmin: { users, deletion },
    handAddedCatalog: new SqliteHandAddedCatalogRepository(db),
    settings: { users, settings, profiles },
    site: {
      profiles,
      sources: { movies, series, seasons, videogames, books },
      publicUrl: options.publicUrl ?? null,
      contactEmail: 'privacy@example.test',
    },
  });
  return {
    app,
    db,
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
    dir,
    deletion,
    invites,
    tokens,
    clock,
  };
}
