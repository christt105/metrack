import type { FastifyInstance } from 'fastify';
import type { PublishQueue } from '../publish/PublishQueue.js';

/**
 * Marks the site as changed after any successful write under `/api`, and lets a client ask for a
 * publish explicitly. The queue decides whether anything actually needs deploying.
 */
export function registerPublishRoutes(app: FastifyInstance, queue: PublishQueue): void {
  app.addHook('onResponse', async (request, reply) => {
    const writes = request.method !== 'GET' && request.method !== 'HEAD';
    if (writes && request.url.startsWith('/api/') && reply.statusCode < 400) queue.markDirty();
  });

  app.post('/api/publish', async (_request, reply) => {
    queue.markDirty();
    return reply.code(202).send({ status: 'queued', failures: queue.failureCount() });
  });
}
