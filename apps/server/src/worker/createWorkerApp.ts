import type { Hono } from 'hono';
import { AccountDeletionService } from '../account/AccountDeletionService.js';
import { AccountExporter } from '../account/AccountExporter.js';
import type { ApiEnv } from '../api/ApiEnv.js';
import { buildApp } from '../api/buildApp.js';
import { createEditServices } from '../api/createEditServices.js';
import type { ImageProvider } from '../artwork/ImageProvider.js';
import { SteamGridDbImageProvider } from '../artwork/SteamGridDbImageProvider.js';
import { TmdbImageProvider } from '../artwork/TmdbImageProvider.js';
import { ApiTokenService } from '../auth/ApiTokenService.js';
import { SessionCookieAuthenticator } from '../auth/SessionCookieAuthenticator.js';
import { SessionService } from '../auth/SessionService.js';
import { loadConfig } from '../config/loadConfig.js';
import { ImageStore } from '../images/ImageStore.js';
import { R2ImageBlobStore } from '../images/R2ImageBlobStore.js';
import { WebpValidatingEncoder } from '../images/WebpValidatingEncoder.js';
import { MetadataCache } from '../metadata/MetadataCache.js';
import { registerTmdbMetadata } from '../metadata/registerTmdbMetadata.js';
import { IgdbClient } from '../providers/igdb/IgdbClient.js';
import { OpenLibraryClient } from '../providers/openlibrary/OpenLibraryClient.js';
import { SteamGridDbClient } from '../providers/steamgriddb/SteamGridDbClient.js';
import { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import { D1ContentVersions } from '../storage/d1/D1ContentVersions.js';
import { D1PublicRenderCache } from '../storage/d1/D1PublicRenderCache.js';
import { createD1Repositories } from '../storage/d1/createD1Repositories.js';
import { IgdbGameProvider } from '../titles/IgdbGameProvider.js';
import { OpenLibraryBookProvider } from '../titles/OpenLibraryBookProvider.js';
import { TitleProviders } from '../titles/TitleProviders.js';
import { TmdbMovieProvider } from '../titles/TmdbMovieProvider.js';
import { TmdbSeriesProvider } from '../titles/TmdbSeriesProvider.js';
import { WatchlistService } from '../alerts/WatchlistService.js';
import { AsyncUserScope } from '../users/AsyncUserScope.js';
import { D1SchemaVersion } from './D1SchemaVersion.js';
import { stringsOf } from './stringsOf.js';
import type { WorkerEnv } from './WorkerEnv.js';
import { WorkerUrlGuard } from './WorkerUrlGuard.js';

const fetchFn: typeof fetch = (input, init) => fetch(input, init);

/**
 * The same Hono app as the home server, over D1 and R2. Images are always recoded by the browser
 * (`IMAGE_ENCODED_BY=client`). Everything that needs Node, the disk, a timer or a service at home is left out:
 * Jellyfin and Jellystat sync, the vault mirror, Hugo publishing, backups, release alerts, the account export ZIP (the browser
 * builds it from `/api/account/export/data`) and the erasing of deleted accounts.
 */
export function createWorkerApp(env: WorkerEnv, now: () => Date = () => new Date()): Hono<ApiEnv> {
  const config = loadConfig({ ...stringsOf(env), IMAGE_ENCODED_BY: 'client' });
  const logger = { info: console.log, error: console.error };
  const scope = new AsyncUserScope();
  const repositories = createD1Repositories(env.DB, scope);
  const { movies, series, seasons, videogames, books, overrides, unlinked } = repositories;

  const imageStore = new ImageStore(
    repositories.images,
    new R2ImageBlobStore(env.IMAGES),
    fetchFn,
    () => new Date(),
    {
      encoder: new WebpValidatingEncoder({
        maxDimension: config.images.maxDimension,
        maxBytes: config.images.maxUploadBytes,
      }),
      urlGuard: new WorkerUrlGuard(),
      quotaBytes: config.images.quotaBytes,
      maxDimension: config.images.maxDimension,
      maxUploadBytes: config.images.maxUploadBytes,
      encodedBy: 'client',
    },
  );
  const metadataCache = new MetadataCache(repositories.metadataStates, imageStore);
  const titleProviders = new TitleProviders();
  const imageProviders: ImageProvider[] = [];
  if (config.tmdbApiKey) {
    const tmdb = new TmdbClient(fetchFn, {
      apiKey: config.tmdbApiKey,
      language: config.tmdbLanguage,
    });
    registerTmdbMetadata(metadataCache, tmdb, { movies, series });
    titleProviders.register(new TmdbMovieProvider(tmdb, movies, metadataCache));
    titleProviders.register(
      new TmdbSeriesProvider(tmdb, series, seasons, metadataCache, imageStore),
    );
    imageProviders.push(new TmdbImageProvider(tmdb));
  }
  const steamGridDb = config.steamGridDbToken
    ? new SteamGridDbClient(fetchFn, config.steamGridDbToken)
    : null;
  if (steamGridDb) imageProviders.push(new SteamGridDbImageProvider(steamGridDb));
  if (config.igdb) {
    titleProviders.register(
      new IgdbGameProvider(
        new IgdbClient(fetchFn, config.igdb),
        videogames,
        imageStore,
        steamGridDb,
      ),
    );
  }
  titleProviders.register(
    new OpenLibraryBookProvider(
      new OpenLibraryClient(fetchFn, config.openLibraryLanguage),
      books,
      imageStore,
    ),
  );

  const edit = createEditServices({
    sources: { movies, series, seasons, videogames, books, overrides },
    unlinked,
    states: repositories.metadataStates,
    images: imageStore,
    cache: metadataCache,
    titleProviders,
    imageProviders,
  });

  const sessions = new SessionService(repositories.sessions, repositories.users);
  return buildApp({
    appVersion: config.appVersion,
    migrationRunner: new D1SchemaVersion(env.DB),
    authenticator: new SessionCookieAuthenticator(sessions),
    scope,
    auth: { sessions, users: repositories.users, devLogin: config.devLogin },
    tokens: new ApiTokenService(repositories.apiTokens, repositories.users),
    logger,
    imageStore,
    metadataCache,
    edit,
    account: {
      exporter: new AccountExporter(
        { ...repositories, images: imageStore },
        () => new Date(),
        false,
      ),
      serverZip: false,
      deletion: new AccountDeletionService(
        repositories.accounts,
        repositories.users,
        imageStore,
        '/dev/null',
        logger,
      ),
      profiles: repositories.profiles,
    },
    handAddedCatalog: repositories.handAddedCatalog,
    settings: {
      users: repositories.users,
      settings: repositories.settings,
      profiles: repositories.profiles,
    },
    site: {
      profiles: repositories.profiles,
      sources: { movies, series, seasons, videogames, books },
      publicUrl: config.publicUrl,
      contactEmail: config.contactEmail,
      renderCache: new D1PublicRenderCache(env.DB, now),
    },
    contentVersions: new D1ContentVersions(env.DB),
    watch: {
      watchlist: new WatchlistService(edit.editor, movies, series, seasons),
      alerts: repositories.releaseAlerts,
    },
  });
}
