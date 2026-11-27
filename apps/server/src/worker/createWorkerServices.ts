import { AccountDeletionService } from '../account/AccountDeletionService.js';
import { createEditServices } from '../api/createEditServices.js';
import { SteamGridDbImageProvider } from '../artwork/SteamGridDbImageProvider.js';
import { loadConfig } from '../config/loadConfig.js';
import { ImageStore } from '../images/ImageStore.js';
import { R2ImageBlobStore } from '../images/R2ImageBlobStore.js';
import { WebpValidatingEncoder } from '../images/WebpValidatingEncoder.js';
import { createProviderRegistry } from '../providers/createProviderRegistry.js';
import { IgdbClient } from '../providers/igdb/IgdbClient.js';
import { SteamGridDbClient } from '../providers/steamgriddb/SteamGridDbClient.js';
import { createD1Repositories } from '../storage/d1/createD1Repositories.js';
import { createSteamServices } from '../steam/createSteamServices.js';
import { IgdbGameProvider } from '../titles/IgdbGameProvider.js';
import { AsyncUserScope } from '../users/AsyncUserScope.js';
import { GameArtworkBackfill } from '../backfill/GameArtworkBackfill.js';
import { MovieRuntimeBackfill } from '../backfill/MovieRuntimeBackfill.js';
import { SeasonCacheJob } from '../seasons/SeasonCacheJob.js';
import { ScheduledTick } from './ScheduledTick.js';
import { stringsOf } from './stringsOf.js';
import type { WorkerEnv } from './WorkerEnv.js';
import type { WorkerServices } from './WorkerServices.js';
import { WorkerUrlGuard } from './WorkerUrlGuard.js';
import { workerFetch } from './workerFetch.js';

/**
 * Builds what both the `fetch` and the `scheduled` handler of the Worker need, over D1 and R2, once per isolate.
 * Images are always recoded by the browser (`IMAGE_ENCODED_BY=client`). The scheduled tick erases deleted
 * accounts, which have no data directory to clean here, and leaves their images for the connector's orphan cleanup.
 */
export function createWorkerServices(
  env: WorkerEnv,
  now: () => Date = () => new Date(),
): WorkerServices {
  const config = loadConfig({ ...stringsOf(env), IMAGE_ENCODED_BY: 'client' });
  const logger = { info: console.log, error: console.error };
  const scope = new AsyncUserScope();
  const repositories = createD1Repositories(env.DB, scope);
  const { movies, series, seasons, videogames, books, unlinked } = repositories;

  const imageStore = new ImageStore(
    repositories.images,
    new R2ImageBlobStore(env.IMAGES),
    workerFetch,
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
  const steamGridDb = config.steamGridDbToken
    ? new SteamGridDbClient(workerFetch, config.steamGridDbToken)
    : null;
  const igdbClient = config.igdb && new IgdbClient(workerFetch, config.igdb);
  const igdbGames =
    igdbClient &&
    new IgdbGameProvider(igdbClient, videogames, imageStore, steamGridDb, repositories.gameArtwork);
  const { metadataCache, titleProviders, imageProviders, tmdb } = createProviderRegistry(
    config,
    workerFetch,
    repositories,
    imageStore,
    {
      title: igdbGames,
      image: steamGridDb ? new SteamGridDbImageProvider(steamGridDb) : undefined,
    },
  );
  const gameArtwork =
    igdbClient &&
    new GameArtworkBackfill(repositories.gameArtwork, imageStore, igdbClient, steamGridDb, logger);
  const steam = createSteamServices(
    config.steamApiKey,
    workerFetch,
    videogames,
    repositories.settings,
    igdbClient &&
      igdbGames &&
      gameArtwork && { client: igdbClient, adder: igdbGames, artwork: gameArtwork },
  );

  const edit = createEditServices({
    sources: {
      movies,
      series,
      seasons,
      videogames,
      books,
      episodeWatches: repositories.episodeWatches,
    },
    unlinked,
    states: repositories.metadataStates,
    images: imageStore,
    cache: metadataCache,
    ...(tmdb ? { tmdb } : {}),
    seasonEpisodes: repositories.seasonEpisodes,
    seasonFiller: repositories.seasonFiller,
    episodeWatches: repositories.episodeWatches,
    titleProviders,
    imageProviders,
    fetchFn: workerFetch,
  });

  const accountDeletion = new AccountDeletionService(
    repositories.accounts,
    repositories.users,
    null,
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
    steam,
    accountDeletion,
    scheduled: new ScheduledTick({
      accounts: accountDeletion,
      ...(tmdb
        ? { runtimes: new MovieRuntimeBackfill(repositories.movieRuntimes, tmdb, logger) }
        : {}),
      ...(gameArtwork ? { artwork: gameArtwork } : {}),
      seasonCache: new SeasonCacheJob(repositories.users, scope, edit.seasonCache, logger),
      logger,
    }),
  };
}
