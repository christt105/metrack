import { join } from 'node:path';
import { buildApp } from './api/buildApp.js';
import { createEditServices } from './api/createEditServices.js';
import type { ImageProvider } from './artwork/ImageProvider.js';
import { SteamGridDbImageProvider } from './artwork/SteamGridDbImageProvider.js';
import { TmdbImageProvider } from './artwork/TmdbImageProvider.js';
import { loadConfig } from './config/loadConfig.js';
import { ImageStore } from './images/ImageStore.js';
import { LogNotifier } from './notify/LogNotifier.js';
import { MetadataCache } from './metadata/MetadataCache.js';
import { MetadataStateRepository } from './metadata/MetadataStateRepository.js';
import { movieLifecycle } from './metadata/movieLifecycle.js';
import { seriesLifecycle } from './metadata/seriesLifecycle.js';
import { CloudflarePagesPublisher } from './publish/CloudflarePagesPublisher.js';
import { FilePublishState } from './publish/FilePublishState.js';
import { loadPublishConfig } from './publish/loadPublishConfig.js';
import { NodeCommandRunner } from './publish/NodeCommandRunner.js';
import { PublishPipeline } from './publish/PublishPipeline.js';
import { PublishQueue } from './publish/PublishQueue.js';
import { TimerScheduler } from './publish/TimerScheduler.js';
import { SteamGridDbClient } from './providers/steamgriddb/SteamGridDbClient.js';
import { TmdbClient } from './providers/tmdb/TmdbClient.js';
import { TmdbMovieSource } from './providers/tmdb/TmdbMovieSource.js';
import { TmdbSeriesSource } from './providers/tmdb/TmdbSeriesSource.js';
import { ReleaseWatcher } from './alerts/ReleaseWatcher.js';
import { ReleaseWatchScheduler } from './alerts/ReleaseWatchScheduler.js';
import { WatchlistService } from './alerts/WatchlistService.js';
import { TmdbReleaseSource } from './providers/tmdb/TmdbReleaseSource.js';
import { BackupJob } from './backup/BackupJob.js';
import { BackupScheduler } from './backup/BackupScheduler.js';
import { createBackupService } from './backup/createBackupService.js';
import { createNotifier } from './notify/createNotifier.js';
import { MigrationRunner } from './storage/MigrationRunner.js';
import { migrations } from './storage/migrations/index.js';
import { TitleProviders } from './titles/TitleProviders.js';
import { TmdbMovieProvider } from './titles/TmdbMovieProvider.js';
import { TmdbSeriesProvider } from './titles/TmdbSeriesProvider.js';
import { createSyncService } from './sync/createSyncService.js';
import { loadSyncConfig } from './sync/loadSyncConfig.js';
import { openDatabase } from './storage/openDatabase.js';
import {
  BookRepository,
  MovieRepository,
  ReleaseAlertRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
  VideogameRepository,
} from './storage/repositories/index.js';

const config = loadConfig(process.env);
const logger = { info: console.log, error: console.error };
const db = openDatabase(join(config.dataDir, 'metrack.db'));
const migrationRunner = new MigrationRunner(db, migrations);
const schemaVersion = migrationRunner.run();

const movies = new MovieRepository(db);
const series = new SeriesRepository(db);
const seasons = new SeasonRepository(db);
const videogames = new VideogameRepository(db);
const books = new BookRepository(db);
const overrides = new SeasonOverrideRepository(db);
const unlinked = new UnlinkedTitleRepository(db);
const releaseAlerts = new ReleaseAlertRepository(db);

const imageStore = new ImageStore(db, join(config.dataDir, 'images'));
const metadataStates = new MetadataStateRepository(db);
const metadataCache = new MetadataCache(metadataStates, imageStore);
const titleProviders = new TitleProviders();
const imageProviders: ImageProvider[] = [];
let releaseScheduler: ReleaseWatchScheduler | undefined;
if (config.tmdbApiKey) {
  const tmdb = new TmdbClient(fetch, { apiKey: config.tmdbApiKey, language: config.tmdbLanguage });
  metadataCache.register('movie', {
    repository: movies,
    source: new TmdbMovieSource(tmdb),
    lifecycle: movieLifecycle,
  });
  metadataCache.register('series', {
    repository: series,
    source: new TmdbSeriesSource(tmdb),
    lifecycle: seriesLifecycle,
  });
  titleProviders.register(new TmdbMovieProvider(tmdb, movies, metadataCache));
  titleProviders.register(new TmdbSeriesProvider(tmdb, series, seasons, metadataCache, imageStore));
  imageProviders.push(new TmdbImageProvider(tmdb));
  if (config.alerts.enabled) {
    releaseScheduler = new ReleaseWatchScheduler(
      new ReleaseWatcher({
        movies,
        series,
        seasons,
        overrides,
        alerts: releaseAlerts,
        source: new TmdbReleaseSource(tmdb),
        notifier: createNotifier(config.ntfy, logger),
        logger,
        timeZone: config.alerts.timeZone,
        notifyFromHour: config.alerts.notifyFromHour,
      }),
      logger,
    );
  }
}
if (config.steamGridDbToken) {
  imageProviders.push(
    new SteamGridDbImageProvider(new SteamGridDbClient(fetch, config.steamGridDbToken)),
  );
}

const edit = createEditServices({
  sources: { movies, series, seasons, videogames, books, overrides },
  unlinked,
  states: metadataStates,
  images: imageStore,
  cache: metadataCache,
  titleProviders,
  imageProviders,
});

const { config: syncConfig, missing: syncMissing } = loadSyncConfig(process.env);
const syncSetup = syncConfig
  ? createSyncService(syncConfig, db, { movies, series, seasons, overrides, unlinked })
  : undefined;
if (!syncSetup) console.log(`Jellyfin sync is disabled, missing: ${syncMissing.join(', ')}`);

const { config: publishConfig, missing: publishMissing } = loadPublishConfig(process.env);
let publishQueue: PublishQueue | undefined;
if (publishConfig) {
  const runner = new NodeCommandRunner();
  const pipeline = new PublishPipeline(
    {
      movies,
      series,
      seasons,
      videogames,
      books,
      images: imageStore,
    },
    {
      siteTemplateDir: publishConfig.siteTemplateDir,
      workDir: join(config.dataDir, 'publish'),
      hugoBinary: publishConfig.hugoBinary,
    },
    runner,
    new CloudflarePagesPublisher(publishConfig, runner),
    new FilePublishState(join(config.dataDir, 'publish-state.json')),
  );
  publishQueue = new PublishQueue(
    () => pipeline.run(),
    new LogNotifier(logger),
    logger,
    new TimerScheduler(),
  );
} else {
  console.log(`Publishing is disabled, missing: ${publishMissing.join(', ')}`);
}

const backupService = createBackupService(config, db);
const backupJob = new BackupJob(
  backupService,
  config.backup.retention,
  createNotifier(config.ntfy, logger),
  logger,
);
const scheduler = new BackupScheduler(
  backupService,
  backupJob,
  config.backup.intervalHours * 3_600_000,
  logger,
);

const app = await buildApp({
  appVersion: config.appVersion,
  migrationRunner,
  webDir: config.webDir,
  imageStore,
  metadataCache,
  publishQueue,
  edit,
  backup: { service: backupService, job: backupJob },
  sync: syncSetup?.service,
  watch: {
    watchlist: new WatchlistService(edit.editor, movies, series, seasons),
    alerts: releaseAlerts,
  },
});

const shutdown = async (): Promise<void> => {
  scheduler.stop();
  releaseScheduler?.stop();
  await app.close();
  await syncSetup?.pool.end();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: config.host });
if (config.backup.enabled) {
  scheduler.start();
}
releaseScheduler?.start();
if (!releaseScheduler)
  console.log(
    'Release alerts are disabled, they need TMDB_API_KEY and ALERTS_ENABLED not set to false',
  );
console.log(`metrack listening on ${config.host}:${config.port} (schema v${schemaVersion})`);
