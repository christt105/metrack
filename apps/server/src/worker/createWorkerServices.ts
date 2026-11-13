import { AccountDeletionService } from '../account/AccountDeletionService.js';
import { createEditServices } from '../api/createEditServices.js';
import type { ImageProvider } from '../artwork/ImageProvider.js';
import { SteamGridDbImageProvider } from '../artwork/SteamGridDbImageProvider.js';
import { TmdbImageProvider } from '../artwork/TmdbImageProvider.js';
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
import { createD1Repositories } from '../storage/d1/createD1Repositories.js';
import { IgdbGameProvider } from '../titles/IgdbGameProvider.js';
import { OpenLibraryBookProvider } from '../titles/OpenLibraryBookProvider.js';
import { TitleProviders } from '../titles/TitleProviders.js';
import { TmdbMovieProvider } from '../titles/TmdbMovieProvider.js';
import { TmdbSeriesProvider } from '../titles/TmdbSeriesProvider.js';
import { AsyncUserScope } from '../users/AsyncUserScope.js';
import { ScheduledTick } from './ScheduledTick.js';
import { stringsOf } from './stringsOf.js';
import type { WorkerEnv } from './WorkerEnv.js';
import type { WorkerServices } from './WorkerServices.js';
import { WorkerUrlGuard } from './WorkerUrlGuard.js';

const fetchFn: typeof fetch = (input, init) => fetch(input, init);

/**
 * Builds what both the `fetch` and the `scheduled` handler of the Worker need, over D1 and R2, once per isolate.
 * Images are always recoded by the browser (`IMAGE_ENCODED_BY=client`). The scheduled tick erases deleted
 * accounts, which have no data directory to clean here.
 */
export function createWorkerServices(
  env: WorkerEnv,
  now: () => Date = () => new Date(),
): WorkerServices {
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
  const tmdb = config.tmdbApiKey
    ? new TmdbClient(fetchFn, { apiKey: config.tmdbApiKey, language: config.tmdbLanguage })
    : undefined;
  if (tmdb) {
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

  const accountDeletion = new AccountDeletionService(
    repositories.accounts,
    repositories.users,
    imageStore,
    null,
    logger,
    now,
  );
  return {
    config,
    logger,
    scope,
    repositories,
    imageStore,
    metadataCache,
    edit,
    accountDeletion,
    scheduled: new ScheduledTick({ accounts: accountDeletion, logger }),
  };
}
