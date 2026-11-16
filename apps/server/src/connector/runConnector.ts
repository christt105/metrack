import { serve } from '@hono/node-server';
import { WebhookSecret } from '../api/WebhookSecret.js';
import type { Config } from '../config/Config.js';
import type { Logger } from '../notify/Logger.js';
import { createNotifier } from '../notify/createNotifier.js';
import { TimerScheduler } from '../publish/TimerScheduler.js';
import type { SyncSources } from '../sync/SyncSources.js';
import { ReleaseWatchScheduler } from '../alerts/ReleaseWatchScheduler.js';
import { TmdbReleaseSource } from '../providers/tmdb/TmdbReleaseSource.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import { CloudBackupJob } from '../cloudbackup/CloudBackupJob.js';
import { CloudBackupScheduler } from '../cloudbackup/CloudBackupScheduler.js';
import { createCloudBackup } from '../cloudbackup/createCloudBackup.js';
import { createCloudflareUsageScheduler } from '../cloudflare-usage/createCloudflareUsageScheduler.js';
import { loadCloudflareUsageConfig } from '../cloudflare-usage/loadCloudflareUsageConfig.js';
import { CloudImageCleanupJob } from '../cloudcleanup/CloudImageCleanupJob.js';
import { createCloudImageCleanup } from '../cloudcleanup/createCloudImageCleanup.js';
import { CloudClient } from './CloudClient.js';
import type { ConnectorConfig } from './ConnectorConfig.js';
import { ConnectorQueue } from './ConnectorQueue.js';
import { ConnectorReleaseAlerts } from './ConnectorReleaseAlerts.js';
import { ConnectorStateStore } from './ConnectorStateStore.js';
import { DailyMessageCounter } from './DailyMessageCounter.js';
import { createConnectorApp } from './createConnectorApp.js';
import { describeUserSync } from './describeUserSync.js';
import { FullPass } from './FullPass.js';
import { UserSync } from './UserSync.js';

/**
 * Starts the connector: the webhook endpoint, the queue of pending syncs and the periodic pass over every user.
 * Returns a function that stops the HTTP server and the alert timers; the timers do not keep the process alive.
 * `env` supplies the Cloudflare usage alert settings.
 */
export function runConnector(
  config: ConnectorConfig,
  app: Pick<Config, 'port' | 'host' | 'ntfy'>,
  sources: (jellyfinUser: string) => SyncSources,
  logger: Logger,
  tmdb?: TmdbClient,
  env: Record<string, string | undefined> = process.env,
): () => void {
  const cloud = new CloudClient(config.cloudUrl, config.token);
  const notifier = createNotifier(app.ntfy, logger);
  const scheduler = new TimerScheduler();
  const store = new ConnectorStateStore(config.dataDir);
  const sync = new UserSync(cloud, sources, config.sync.timeZone, logger);
  const queue = new ConnectorQueue(
    async (userId) => {
      const user = (await cloud.users()).find((candidate) => candidate.id === userId);
      return user
        ? describeUserSync(await sync.run(user, true))
        : 'skipped, no Jellyfin user is set';
    },
    store,
    notifier,
    logger,
    scheduler,
    { debounceMs: config.sync.webhookDelayMs },
  );
  const pass = new FullPass(
    cloud,
    queue,
    store,
    notifier,
    logger,
    scheduler,
    config.passIntervalMs,
    config.sync.webhookDelayMs,
  );
  if (config.cloudBackup) {
    const backup = createCloudBackup(config.cloudBackup);
    new CloudBackupScheduler(
      backup,
      new CloudBackupJob(backup, notifier, logger),
      config.cloudBackup.time,
      scheduler,
      undefined,
      config.cloudImageCleanup
        ? new CloudImageCleanupJob(
            createCloudImageCleanup(config.cloudImageCleanup, logger),
            notifier,
            logger,
          )
        : undefined,
    ).start();
    const { hour, minute } = config.cloudBackup.time;
    logger.info(
      `cloud backup on: every day at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} into ${config.cloudBackup.dir}, keeping ${config.cloudBackup.retention}`,
    );
    if (config.cloudImageCleanup) logger.info('cloud image cleanup on: after each cloud backup');
  }
  const alertScheduler = startReleaseAlerts(config, cloud, store, tmdb, logger);
  const usageScheduler = createCloudflareUsageScheduler(env, app.ntfy, config.dataDir, logger);
  if (usageScheduler) {
    usageScheduler.start();
    const usage = loadCloudflareUsageConfig(env);
    logger.info(
      `cloudflare usage alerts on: every 15 minutes, warning at ${usage?.warnPercent}% and critical at ${usage?.criticalPercent}% of the free plan, to ${app.ntfy?.url}`,
    );
  }
  const server = serve({
    fetch: createConnectorApp({
      secret: config.sync.webhookSecret ? new WebhookSecret(config.sync.webhookSecret) : undefined,
      onWebhook: () => pass.queueUsersForWebhook(),
    }).fetch,
    port: app.port,
    hostname: app.host,
  });
  queue.restore();
  void pass.run();
  logger.info(
    `metrack connector listening on ${app.host}:${app.port}, syncing into ${config.cloudUrl}`,
  );
  return () => {
    alertScheduler?.stop();
    usageScheduler?.stop();
    server.close();
    if ('closeIdleConnections' in server) server.closeIdleConnections();
  };
}

function startReleaseAlerts(
  config: ConnectorConfig,
  cloud: CloudClient,
  store: ConnectorStateStore,
  tmdb: TmdbClient | undefined,
  logger: Logger,
): ReleaseWatchScheduler | undefined {
  const alerts = config.releaseAlerts;
  if (!alerts) return undefined;
  if (!tmdb) {
    logger.error('release alerts are enabled but TMDB_API_KEY is not set, so none are sent');
    return undefined;
  }
  const scheduler = new ReleaseWatchScheduler(
    new ConnectorReleaseAlerts(
      cloud,
      new TmdbReleaseSource(tmdb),
      alerts,
      new DailyMessageCounter(store, alerts.dailyLimit, logger),
      logger,
    ),
    logger,
  );
  scheduler.start(alerts.tickMs);
  logger.info(
    `release alerts on: from ${alerts.notifyFromHour}:00 Madrid time to ${alerts.ntfyUrl}, at most ${alerts.dailyLimit} a day`,
  );
  return scheduler;
}
