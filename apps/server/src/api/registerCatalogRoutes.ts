import type { FastifyInstance } from 'fastify';
import {
  CATALOG_COLLECTIONS,
  canAddByHand,
  type CatalogCollection,
  type UnreferencedCatalogItem,
} from '@metrack/domain';
import type { HandAddedCatalogRepository } from '../storage/repositories/HandAddedCatalogRepository.js';
import { ApiError } from './ApiError.js';
import { requireUser } from './requireUser.js';
import './fastifyTypes.js';

const params = {
  type: 'object',
  properties: {
    collection: { enum: [...CATALOG_COLLECTIONS] },
    id: { type: 'integer', minimum: 1 },
  },
  required: ['collection', 'id'],
} as const;

/**
 * Catalog items added by hand stay when their creator's account is deleted, passing to the owner. When no
 * user has an entry for one any more, `GET /api/catalog/unreferenced` lists them (everyone's for the owner,
 * a trusted user's own otherwise) and `DELETE /api/catalog/{collection}/{id}` removes one. An item some
 * user still has is refused with 409.
 */
export function registerCatalogRoutes(
  app: FastifyInstance,
  catalog: HandAddedCatalogRepository,
): void {
  app.get(
    '/api/catalog/unreferenced',
    { config: { trustedOnly: true } },
    async (request): Promise<UnreferencedCatalogItem[]> => {
      const user = requireUser(request.user);
      return catalog.listUnreferenced(user.role === 'owner' ? undefined : user.id);
    },
  );

  app.delete<{ Params: { collection: CatalogCollection; id: number } }>(
    '/api/catalog/:collection/:id',
    { config: { trustedOnly: true }, schema: { params } },
    async (request, reply) => {
      const user = requireUser(request.user);
      const { collection, id } = request.params;
      const row = await catalog.find(collection, id);
      if (
        !row ||
        (user.role !== 'owner' && (row.ownerId !== user.id || !canAddByHand(user.role)))
      ) {
        throw ApiError.notFound('There is no such item added by hand');
      }
      if (row.referenced) {
        throw ApiError.conflict('catalog_in_use', 'Some user still has this item');
      }
      await catalog.delete(collection, id);
      return reply.code(204).send();
    },
  );
}
