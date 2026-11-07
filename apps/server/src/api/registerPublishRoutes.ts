import type { FastifyInstance } from 'fastify';
import type { UserQueues } from '../users/UserQueues.js';
import { ApiError } from './ApiError.js';

/**
 * Marks every published site as changed after any successful write under `/api`, since titles are shared, and
 * lets a user ask for their own site to be published. Each queue decides whether anything actually needs
 * deploying.
 */
export function registerPublishRoutes(app: FastifyInstance, queues: UserQueues): void {
  app.addHook('onResponse', async (request, reply) => {
    const writes = request.method !== 'GET' && request.method !== 'HEAD';
    if (writes && request.url.startsWith('/api/') && reply.statusCode < 400) {
      await queues.markAllDirty();
    }
  });

  app.post('/api/publish', async (request, reply) => {
    const userId = request.user?.id;
    if (userId === undefined || !(await queues.markDirty(userId))) {
      throw ApiError.notImplemented(
        'publish_not_configured',
        'No Cloudflare Pages project is set for you',
      );
    }
    return reply.code(202).send({ status: 'queued', failures: queues.failureCount(userId) });
  });
}
