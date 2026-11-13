import { serve } from '@hono/node-server';
import { WebhookSecret } from '../api/WebhookSecret.js';
import type { Config } from '../config/Config.js';
import type { Logger } from '../notify/Logger.js';
import { createNotifier } from '../notify/createNotifier.js';
import { TimerScheduler } from '../publish/TimerScheduler.js';
import type { SyncSources } from '../sync/SyncSources.js';
import { CloudClient } from './CloudClient.js';
import type { ConnectorConfig } from './ConnectorConfig.js';
import { ConnectorQueue } from './ConnectorQueue.js';
import { ConnectorStateStore } from './ConnectorStateStore.js';
import { createConnectorApp } from './createConnectorApp.js';
import { describeUserSync } from './describeUserSync.js';
import { FullPass } from './FullPass.js';
import { UserSync } from './UserSync.js';

/**
 * Starts the connector: the webhook endpoint, the queue of pending syncs and the periodic pass over every user.
 * Resolves to a function that stops the HTTP server; the timers do not keep the process alive.
 */
export function runConnector(
  config: ConnectorConfig,
  app: Pick<Config, 'port' | 'host' | 'ntfy'>,
  sources: (jellyfinUser: string) => SyncSources,
  logger: Logger,
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
  );
  const server = serve({
    fetch: createConnectorApp({
      secret: config.sync.webhookSecret ? new WebhookSecret(config.sync.webhookSecret) : undefined,
      onWebhook: async () => {
        const known = pass.knownUsers();
        if (known.length === 0) return (await pass.queueUsers()).length;
        queue.markAll(known);
        return known.length;
      },
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
    server.close();
    if ('closeIdleConnections' in server) server.closeIdleConnections();
  };
}
