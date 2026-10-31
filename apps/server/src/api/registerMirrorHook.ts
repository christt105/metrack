import type { FastifyInstance } from 'fastify';
import type { PublishQueue } from '../publish/PublishQueue.js';

/** Refreshes the vault mirror after any successful write under `/api`. */
export function registerMirrorHook(app: FastifyInstance, queue: PublishQueue): void {
  app.addHook('onResponse', async (request, reply) => {
    const writes = request.method !== 'GET' && request.method !== 'HEAD';
    if (writes && request.url.startsWith('/api/') && reply.statusCode < 400) queue.markDirty();
  });
}
