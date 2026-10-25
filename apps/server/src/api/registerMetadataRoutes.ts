import type { FastifyInstance } from 'fastify';
import { MEDIA_TYPES, type MediaType, type RefreshResult } from '@metrack/domain';
import type { MediaEditor } from '../media/MediaEditor.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import { COLLECTIONS, MEDIA_TYPE_OF_COLLECTION } from '@metrack/domain';
import { ApiError } from './ApiError.js';

const params = {
  type: 'object',
  properties: { type: { enum: [...MEDIA_TYPES] }, id: { type: 'integer', minimum: 1 } },
  required: ['type', 'id'],
} as const;

/** Forces a provider refresh of one entity. Fields edited by hand are kept. */
export function registerMetadataRoutes(
  app: FastifyInstance,
  cache: MetadataCache,
  editor?: MediaEditor,
): void {
  app.post<{ Params: { type: MediaType; id: number } }>(
    '/api/metadata/:type/:id/refresh',
    { schema: { params } },
    async (request): Promise<RefreshResult> => {
      const { type, id } = request.params;
      if (!cache.supports(type)) {
        throw ApiError.notImplemented(
          'no_metadata_source',
          `No metadata source is configured for ${type}`,
        );
      }
      const collection = COLLECTIONS.find((c) => MEDIA_TYPE_OF_COLLECTION[c] === type);
      if (editor && collection) editor.require(collection, id);
      try {
        return await cache.refresh(type, id, true);
      } catch {
        throw ApiError.notFound();
      }
    },
  );
}
