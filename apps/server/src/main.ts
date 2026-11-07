import { join } from 'node:path';
import { buildApp } from './api/buildApp.js';
import { SessionCookieAuthenticator } from './auth/SessionCookieAuthenticator.js';
import { SessionService } from './auth/SessionService.js';
import { AsyncUserScope } from './users/AsyncUserScope.js';
import { seedOwnerSettings } from './users/seedOwnerSettings.js';
import { UserJobContext } from './users/UserJobContext.js';
import { createEditServices } from './api/createEditServices.js';
import type { ImageProvider } from './artwork/ImageProvider.js';
import { SteamGridDbImageProvider } from './artwork/SteamGridDbImageProvider.js';
import { TmdbImageProvider } from './artwork/TmdbImageProvider.js';
import { loadConfig } from './config/loadConfig.js';
import { createImageStore } from './images/createImageStore.js';
import { MetadataCache } from './metadata/MetadataCache.js';
import { registerTmdbMetadata } from './metadata/registerTmdbMetadata.js';
import { createUserPublishQueues } from './publish/createUserPublishQueues.js';
import { loadPublishConfig } from './publish/loadPublishConfig.js';
import { NodeCommandRunner } from './publish/NodeCommandRunner.js';
import { createUserSyncQueues } from './sync/createUserSyncQueues.js';
import { openJellystatPool } from './sync/jellystat/openJellystatPool.js';
import { UserSyncServices } from './sync/UserSyncServices.js';
import { createUserMirrorQueues } from './mirror/createUserMirrorQueues.js';
import { TimerScheduler } from './publish/TimerScheduler.js';
import { IgdbClient } from './providers/igdb/IgdbClient.js';
import { OpenLibraryClient } from './providers/openlibrary/OpenLibraryClient.js';
import { SteamGridDbClient } from './providers/steamgriddb/SteamGridDbClient.js';
import { TmdbClient } from './providers/tmdb/TmdbClient.js';
import { ReleaseWatcher } from './alerts/ReleaseWatcher.js';
import { ReleaseWatchScheduler } from './alerts/ReleaseWatchScheduler.js';
import { UserReleaseWatchers } from './alerts/UserReleaseWatchers.js';
import { WatchlistService } from './alerts/WatchlistService.js';
import { TmdbReleaseSource } from './providers/tmdb/TmdbReleaseSource.js';
import { createBackupJob } from './backup/createBackupJob.js';
import { BackupScheduler } from './backup/BackupScheduler.js';
import { createBackupService } from './backup/createBackupService.js';
import { createNotifier } from './notify/createNotifier.js';
import { MigrationRunner } from './storage/MigrationRunner.js';
import { migrations } from './storage/migrations/index.js';
import { IgdbGameProvider } from './titles/IgdbGameProvider.js';
import { OpenLibraryBookProvider } from './titles/OpenLibraryBookProvider.js';
import { TitleProviders } from './titles/TitleProviders.js';
import { TmdbMovieProvider } from './titles/TmdbMovieProvider.js';
import { TmdbSeriesProvider } from './titles/TmdbSeriesProvider.js';
import { createSyncService } from './sync/createSyncService.js';
import { loadSyncConfig } from './sync/loadSyncConfig.js';
import { WebhookSecret } from './api/WebhookSecret.js';
import { openDatabase } from './storage/sqlite/openDatabase.js';
import { createSqliteRepositories } from './storage/sqlite/createSqliteRepositories.js';

const config = loadConfig(process.env);
const logger = { info: console.log, error: console.error };
const notifier = createNotifier(config.ntfy, logger);
const db = openDatabase(join(config.dataDir, 'metrack.db'));
const migrationRunner = new MigrationRunner(db, migrations);
const schemaVersion = migrationRunner.run();

const scope = new AsyncUserScope();
const repositories = createSqliteRepositories(db, scope);
await seedOwnerSettings(repositories.settings, process.env, logger);
const jobs = new UserJobContext({
  timer: new TimerScheduler(),
  scope,
  settings: repositories.settings,
  ntfy: config.ntfyServer,
  logger,
});
const {
  movies,
  series,
  seasons,
  videogames,
  books,
  overrides,
  unlinked,
  releaseAlerts,
  metadataStates,
} = repositories;

const imageStore = createImageStore(db, join(config.dataDir, 'images'));
const metadataCache = new MetadataCache(metadataStates, imageStore);
const titleProviders = new TitleProviders();
const imageProviders: ImageProvider[] = [];
let releaseScheduler: ReleaseWatchScheduler | undefined;
const tmdb = config.tmdbApiKey
  ? new TmdbClient(fetch, { apiKey: config.tmdbApiKey, language: config.tmdbLanguage })
  : undefined;
if (tmdb) {
  registerTmdbMetadata(metadataCache, tmdb, { movies, series });
  titleProviders.register(new TmdbMovieProvider(tmdb, movies, metadataCache));
  titleProviders.register(new TmdbSeriesProvider(tmdb, series, seasons, metadataCache, imageStore));
  imageProviders.push(new TmdbImageProvider(tmdb));
  if (config.alerts.enabled && jobs.canNotify) {
    const source = new TmdbReleaseSource(tmdb);
    releaseScheduler = new ReleaseWatchScheduler(
      new UserReleaseWatchers(
        () => jobs.usersWith((settings) => settings.ntfyTopic),
        (userId) =>
          new ReleaseWatcher({
            movies,
            series,
            seasons,
            overrides,
            alerts: releaseAlerts,
            source,
            notifier: jobs.notifier(userId),
            logger: jobs.logger(userId),
            timeZone: config.alerts.timeZone,
            notifyFromHour: config.alerts.notifyFromHour,
          }),
        scope,
        logger,
      ),
      logger,
    );
  }
}
const steamGridDb = config.steamGridDbToken
  ? new SteamGridDbClient(fetch, config.steamGridDbToken)
  : null;
if (steamGridDb) imageProviders.push(new SteamGridDbImageProvider(steamGridDb));
if (config.igdb) {
  titleProviders.register(
    new IgdbGameProvider(new IgdbClient(fetch, config.igdb), videogames, imageStore, steamGridDb),
  );
}
titleProviders.register(
  new OpenLibraryBookProvider(
    new OpenLibraryClient(fetch, config.openLibraryLanguage),
    books,
    imageStore,
  ),
);

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
const jellystatPool = syncConfig ? openJellystatPool(syncConfig.jellystat, logger) : undefined;
const syncServices =
  syncConfig && jellystatPool
    ? new UserSyncServices(repositories.settings, (jellyfinUser) =>
        createSyncService(
          syncConfig,
          jellyfinUser,
          jellystatPool,
          repositories.transactions,
          { movies, series, seasons, overrides, unlinked },
          tmdb && { client: tmdb, metadata: metadataCache },
        ),
      )
    : undefined;
if (!syncServices) console.log(`Jellyfin sync is disabled, missing: ${syncMissing.join(', ')}`);

const exportSources = { movies, series, seasons, videogames, books, images: imageStore };

const { config: publishConfig, missing: publishMissing } = loadPublishConfig(process.env);
const publishQueues = publishConfig
  ? createUserPublishQueues({
      config: publishConfig,
      sources: exportSources,
      dataDir: config.dataDir,
      runner: new NodeCommandRunner(),
      jobs,
    })
  : undefined;
if (!publishQueues) console.log(`Publishing is disabled, missing: ${publishMissing.join(', ')}`);

const mirrorQueues = createUserMirrorQueues({
  sources: exportSources,
  dataDir: config.dataDir,
  webUrl: config.mirrorWebUrl,
  jobs,
});
const mirrored = await mirrorQueues.markAllDirty();
if (mirrored === 0) console.log('The vault mirror is off: no user has a vault folder set');

const syncQueues =
  syncServices && syncConfig
    ? createUserSyncQueues(syncServices, jobs, syncConfig.webhookDelayMs, [
        publishQueues,
        mirrorQueues,
      ])
    : undefined;

const backupService = createBackupService(config, db);
const backupJob = createBackupJob(config, backupService, notifier, logger);
const scheduler = new BackupScheduler(
  backupService,
  backupJob,
  config.backup.intervalHours * 3_600_000,
  logger,
);

const sessions = new SessionService(repositories.sessions, repositories.users);
const app = await buildApp({
  appVersion: config.appVersion,
  migrationRunner,
  authenticator: new SessionCookieAuthenticator(sessions),
  scope,
  auth: { sessions, users: repositories.users, devLogin: config.devLogin },
  logger,
  webDir: config.webDir,
  imageStore,
  metadataCache,
  publishQueues,
  mirrorQueues,
  edit,
  backup: { service: backupService, job: backupJob },
  sync: syncServices,
  syncQueues,
  settings: { users: repositories.users, settings: repositories.settings },
  syncWebhookSecret: syncConfig?.webhookSecret
    ? new WebhookSecret(syncConfig.webhookSecret)
    : undefined,
  watch: {
    watchlist: new WatchlistService(edit.editor, movies, series, seasons),
    alerts: releaseAlerts,
  },
});

const shutdown = async (): Promise<void> => {
  scheduler.stop();
  releaseScheduler?.stop();
  await app.close();
  await jellystatPool?.end();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: config.port, host: config.host });
if (config.backup.enabled) {
  scheduler.start();
}
releaseScheduler?.start();
if (!releaseScheduler)
  console.log(
    'Release alerts are disabled, they need TMDB_API_KEY, NTFY_URL and ALERTS_ENABLED not set to false',
  );
if (config.devLogin)
  console.log('Dev login is on: anyone who reaches the web can sign in as any user');
console.log(`metrack listening on ${config.host}:${config.port} (schema v${schemaVersion})`);
