import type { FastifyInstance } from 'fastify';
import type { UserQueues } from '../users/UserQueues.js';

/** Refreshes every vault mirror after any successful write under `/api`, since titles are shared. */
export function registerMirrorHook(app: FastifyInstance, queues: UserQueues): void {
  app.addHook('onResponse', async (request, reply) => {
    const writes = request.method !== 'GET' && request.method !== 'HEAD';
    if (writes && request.url.startsWith('/api/') && reply.statusCode < 400) {
      await queues.markAllDirty();
    }
  });
}
