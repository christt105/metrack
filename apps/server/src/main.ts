import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { buildApp } from './api/buildApp.js';
import { DiskStaticFiles } from './web/DiskStaticFiles.js';
import { ApiTokenService } from './auth/ApiTokenService.js';
import { SessionCookieAuthenticator } from './auth/SessionCookieAuthenticator.js';
import { InviteService } from './invites/InviteService.js';
import { GoogleSignIn } from './auth/google/GoogleSignIn.js';
import { SessionService } from './auth/SessionService.js';
import { AsyncUserScope } from './users/AsyncUserScope.js';
import { seedOwnerSettings } from './users/seedOwnerSettings.js';
import { UserJobContext } from './users/UserJobContext.js';
import { createEditServices } from './api/createEditServices.js';
import { SteamGridDbImageProvider } from './artwork/SteamGridDbImageProvider.js';
import { loadConfig } from './config/loadConfig.js';
import { createImageStore } from './images/createImageStore.js';
import { storeOptionsFor } from './images/storeOptionsFor.js';
import { createUserSyncQueues } from './sync/createUserSyncQueues.js';
import { openJellystatPool } from './sync/jellystat/openJellystatPool.js';
import { UserSyncServices } from './sync/UserSyncServices.js';
import { createUserMirrorQueues } from './mirror/createUserMirrorQueues.js';
import { TimerScheduler } from './jobs/TimerScheduler.js';
import { createProviderRegistry } from './providers/createProviderRegistry.js';
import { IgdbClient } from './providers/igdb/IgdbClient.js';
import { SteamGridDbClient } from './providers/steamgriddb/SteamGridDbClient.js';
import { HomeReleaseStore } from './alerts/HomeReleaseStore.js';
import { ReleaseWatcher } from './alerts/ReleaseWatcher.js';
import { ReleaseWatchScheduler } from './alerts/ReleaseWatchScheduler.js';
import { UserReleaseWatchers } from './alerts/UserReleaseWatchers.js';
import { WatchlistService } from './alerts/WatchlistService.js';
import { TmdbReleaseSource } from './providers/tmdb/TmdbReleaseSource.js';
import { GameArtworkBackfill } from './backfill/GameArtworkBackfill.js';
import { GameArtworkScheduler } from './backfill/GameArtworkScheduler.js';
import { MovieRuntimeBackfill } from './backfill/MovieRuntimeBackfill.js';
import { MovieRuntimeScheduler } from './backfill/MovieRuntimeScheduler.js';
import { SeasonCacheJob } from './seasons/SeasonCacheJob.js';
import { SeasonCacheScheduler } from './seasons/SeasonCacheScheduler.js';
import { AccountDeletionScheduler } from './account/AccountDeletionScheduler.js';
import { AccountDeletionService } from './account/AccountDeletionService.js';
import { AccountExporter } from './account/AccountExporter.js';
import { createBackupJob } from './backup/createBackupJob.js';
import { BackupScheduler } from './backup/BackupScheduler.js';
import { createBackupService } from './backup/createBackupService.js';
import { createCloudflareUsageScheduler } from './cloudflare-usage/createCloudflareUsageScheduler.js';
import { createNotifier } from './notify/createNotifier.js';
import { MigrationRunner } from './storage/MigrationRunner.js';
import { migrations } from './storage/migrations/index.js';
import { createSteamServices } from './steam/createSteamServices.js';
import { IgdbGameProvider } from './titles/IgdbGameProvider.js';
import { createSyncService } from './sync/createSyncService.js';
import { loadSyncConfig } from './sync/loadSyncConfig.js';
import { MemoryContentVersions } from './site/MemoryContentVersions.js';
import { ConnectorService } from './sync/ConnectorService.js';
import { SyncApplier } from './sync/SyncApplier.js';
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
const { movies, series, seasons, videogames, books, unlinked, releaseAlerts, metadataStates } =
  repositories;

const imageStore = createImageStore(
  db,
  join(config.dataDir, 'images'),
  fetch,
  () => new Date(),
  storeOptionsFor(config.images),
);
const steamGridDb = config.steamGridDbToken
  ? new SteamGridDbClient(fetch, config.steamGridDbToken)
  : null;
const igdb = config.igdb && {
  client: new IgdbClient(fetch, config.igdb),
};
const igdbGames =
  igdb &&
  new IgdbGameProvider(igdb.client, videogames, imageStore, steamGridDb, repositories.gameArtwork);
const { metadataCache, titleProviders, imageProviders, tmdb } = createProviderRegistry(
  config,
  fetch,
  repositories,
  imageStore,
  {
    title: igdbGames,
    image: steamGridDb ? new SteamGridDbImageProvider(steamGridDb) : undefined,
  },
);
let releaseScheduler: ReleaseWatchScheduler | undefined;
if (tmdb && config.alerts.enabled && jobs.canNotify) {
  const source = new TmdbReleaseSource(tmdb);
  releaseScheduler = new ReleaseWatchScheduler(
    new UserReleaseWatchers(
      () => jobs.usersWith((settings) => settings.ntfyTopic),
      (userId) =>
        new ReleaseWatcher({
          store: new HomeReleaseStore({
            movies,
            series,
            seasons,
            alerts: releaseAlerts,
          }),
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
const gameArtwork =
  igdb &&
  new GameArtworkBackfill(repositories.gameArtwork, imageStore, igdb.client, steamGridDb, logger);
const steam = createSteamServices(
  config.steamApiKey,
  fetch,
  videogames,
  repositories.settings,
  igdb &&
    igdbGames &&
    gameArtwork && { client: igdb.client, adder: igdbGames, artwork: gameArtwork },
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
  states: metadataStates,
  images: imageStore,
  cache: metadataCache,
  ...(tmdb ? { tmdb } : {}),
  seasonEpisodes: repositories.seasonEpisodes,
  seasonFiller: repositories.seasonFiller,
  episodeWatches: repositories.episodeWatches,
  titleProviders,
  imageProviders,
  fetchFn: fetch,
});

const contentVersions = new MemoryContentVersions();

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
          {
            movies,
            series,
            seasons,
            unlinked,
            episodeWatches: repositories.episodeWatches,
          },
          tmdb && { client: tmdb, metadata: metadataCache },
          fetch,
          config.dataDir,
        ),
      )
    : undefined;
if (!syncServices) console.log(`Jellyfin sync is disabled, missing: ${syncMissing.join(', ')}`);

const exportSources = { movies, series, seasons, videogames, books, images: imageStore };

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
    ? createUserSyncQueues(
        syncServices,
        jobs,
        syncConfig.webhookDelayMs,
        [mirrorQueues],
        contentVersions,
      )
    : undefined;

const backupService = createBackupService(config, db);
const backupJob = createBackupJob(config, backupService, notifier, logger);
const scheduler = new BackupScheduler(
  backupService,
  backupJob,
  config.backup.intervalHours * 3_600_000,
  logger,
);

const accountDeletion = new AccountDeletionService(
  repositories.accounts,
  repositories.users,
  imageStore,
  config.dataDir,
  logger,
);
const accountScheduler = new AccountDeletionScheduler(accountDeletion, logger);
const seasonCacheScheduler = new SeasonCacheScheduler(
  new SeasonCacheJob(repositories.users, scope, edit.seasonCache, logger),
  logger,
);
const runtimeScheduler = tmdb
  ? new MovieRuntimeScheduler(
      new MovieRuntimeBackfill(repositories.movieRuntimes, tmdb, logger),
      logger,
    )
  : undefined;
const gameArtworkScheduler = gameArtwork
  ? new GameArtworkScheduler(gameArtwork, logger)
  : undefined;
const cloudflareUsageScheduler = createCloudflareUsageScheduler(
  process.env,
  config.ntfy,
  config.dataDir,
  logger,
);

const connector = new ConnectorService({
  users: repositories.users,
  settings: repositories.settings,
  targets: {
    movies,
    series,
    seasons,
    unlinked,
    episodeWatches: repositories.episodeWatches,
  },
  applier: new SyncApplier(repositories.transactions, {
    movies,
    series,
    seasons,
    unlinked,
    episodeWatches: repositories.episodeWatches,
  }),
  versions: contentVersions,
  alerts: releaseAlerts,
  scope,
  states: metadataStates,
  metadata: metadataCache,
  editor: edit.editor,
});

const sessions = new SessionService(repositories.sessions, repositories.users);
const app = buildApp({
  appVersion: config.appVersion,
  migrationRunner,
  authenticator: new SessionCookieAuthenticator(sessions),
  scope,
  auth: {
    sessions,
    users: repositories.users,
    devLogin: config.devLogin,
    google:
      config.google && new GoogleSignIn(config.google, repositories.users, repositories.invites),
    logger,
  },
  tokens: new ApiTokenService(repositories.apiTokens, repositories.users),
  logger,
  web: existsSync(config.webDir) ? new DiskStaticFiles(config.webDir) : undefined,
  imageStore,
  metadataCache,
  mirrorQueues,
  edit,
  backup: { service: backupService, job: backupJob },
  sync: syncServices,
  steam: steam.importer,
  steamAchievements: steam.achievements,
  syncQueues,
  connector,
  contentVersions,
  account: {
    exporter: new AccountExporter({ ...repositories, images: imageStore }),
    serverZip: true,
    deletion: accountDeletion,
    profiles: repositories.profiles,
    users: repositories.users,
  },
  invites: new InviteService(repositories.invites, repositories.users),
  userAdmin: { users: repositories.users, deletion: accountDeletion },
  handAddedCatalog: repositories.handAddedCatalog,
  settings: {
    users: repositories.users,
    settings: repositories.settings,
    profiles: repositories.profiles,
    steamIds: steam.ids,
  },
  syncWebhookSecret: syncConfig?.webhookSecret
    ? new WebhookSecret(syncConfig.webhookSecret)
    : undefined,
  site: {
    profiles: repositories.profiles,
    sources: {
      movies,
      series,
      seasons,
      videogames,
      books,
      seasonEpisodes: repositories.seasonEpisodes,
      episodeWatches: repositories.episodeWatches,
    },
    publicUrl: config.publicUrl,
    contactEmail: config.contactEmail,
  },
  watch: {
    watchlist: new WatchlistService(edit.editor, movies, series, seasons),
    alerts: releaseAlerts,
  },
});

const shutdown = async (): Promise<void> => {
  scheduler.stop();
  accountScheduler.stop();
  seasonCacheScheduler.stop();
  runtimeScheduler?.stop();
  gameArtworkScheduler?.stop();
  cloudflareUsageScheduler?.stop();
  releaseScheduler?.stop();
  server.close();
  if ('closeIdleConnections' in server) server.closeIdleConnections();
  await jellystatPool?.end();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host });
if (config.backup.enabled) {
  scheduler.start();
}
releaseScheduler?.start();
accountScheduler.start();
seasonCacheScheduler.start();
runtimeScheduler?.start();
gameArtworkScheduler?.start();
cloudflareUsageScheduler?.start();
if (!releaseScheduler)
  console.log(
    'Release alerts are disabled, they need TMDB_API_KEY, NTFY_URL and ALERTS_ENABLED not set to false',
  );
if (config.devLogin)
  console.log('Dev login is on: anyone who reaches the web can sign in as any user');
console.log(`metrack listening on ${config.host}:${config.port} (schema v${schemaVersion})`);
