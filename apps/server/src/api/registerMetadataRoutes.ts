import type { FastifyInstance } from 'fastify';
import { MEDIA_TYPES, type MediaType } from '@metrack/domain';
import type { MetadataCache } from '../metadata/MetadataCache.js';

export function registerMetadataRoutes(app: FastifyInstance, cache: MetadataCache): void {
  app.post<{ Params: { type: string; id: string } }>(
    '/api/metadata/:type/:id/refresh',
    async (request, reply) => {
      const type = request.params.type as MediaType;
      const id = Number(request.params.id);
      if (!MEDIA_TYPES.includes(type) || !Number.isInteger(id) || !cache.supports(type)) {
        return reply.code(404).send({ error: 'Not found' });
      }
      try {
        return await cache.refresh(type, id, true);
      } catch {
        return reply.code(404).send({ error: 'Not found' });
      }
    },
  );
}
