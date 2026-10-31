import type { FastifyInstance } from 'fastify';
import type { PublishQueue } from '../publish/PublishQueue.js';
import type { SyncService } from '../sync/SyncService.js';
import { ApiError } from './ApiError.js';

const applyBody = {
  type: 'object',
  properties: { confirm: { const: true } },
  required: ['confirm'],
  additionalProperties: false,
} as const;

/**
 * Jellyfin viewing sync. `GET /api/sync/report` only computes the plan. `POST /api/sync/apply` needs
 * `{ "confirm": true }`, recomputes the plan on the server and writes it. `POST /api/sync/webhook` is the target of the
 * Jellyfin Webhook plugin: it ignores the body, queues a delayed sync and answers 202. All of them answer 501 when sync is not configured.
 */
export function registerSyncRoutes(
  app: FastifyInstance,
  sync: SyncService | undefined,
  queue?: PublishQueue,
): void {
  const ready = (): SyncService => {
    if (!sync) {
      throw ApiError.notImplemented(
        'sync_not_configured',
        'Jellyfin sync needs JELLYFIN_URL, JELLYFIN_TOKEN, JELLYSTAT_DB_HOST and JELLYSTAT_DB_PASSWORD',
      );
    }
    return sync;
  };

  app.get('/api/sync/report', async () => ready().report());

  app.post('/api/sync/apply', { schema: { body: applyBody } }, async () => ready().apply());

  app.post('/api/sync/webhook', async (_request, reply) => {
    ready();
    queue?.markDirty();
    return reply.code(202).send({ status: 'queued', failures: queue?.failureCount() ?? 0 });
  });
}
