import type { FastifyInstance } from 'fastify';
import {
  SEARCHABLE_TYPES,
  type AddTitleRequest,
  type EntityRef,
  type ResolveUnlinkedRequest,
  type ResolveUnlinkedResponse,
  type SearchableType,
  type SearchResult,
  type UnlinkedTitle,
} from '@metrack/domain';
import type { TitleProviders } from '../titles/TitleProviders.js';
import type { UnlinkedResolver } from '../titles/UnlinkedResolver.js';
import type { UnlinkedTitleRepository } from '../storage/repositories/UnlinkedTitleRepository.js';
import { ApiError } from './ApiError.js';

const searchQuery = {
  type: 'object',
  properties: {
    type: { enum: [...SEARCHABLE_TYPES] },
    q: { type: 'string', minLength: 1 },
    year: { type: 'integer', minimum: 1800, maximum: 2200 },
  },
  required: ['type', 'q'],
  additionalProperties: false,
} as const;

const addBody = {
  type: 'object',
  properties: {
    type: { enum: [...SEARCHABLE_TYPES] },
    externalId: { type: 'string', minLength: 1 },
  },
  required: ['type', 'externalId'],
  additionalProperties: false,
} as const;

const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
} as const;

const resolveBody = {
  type: 'object',
  properties: {
    ids: {
      type: 'object',
      properties: {
        tmdbId: { type: 'integer', minimum: 1 },
        tvdbId: { type: 'integer', minimum: 1 },
        jellyfinId: { type: 'string', minLength: 1 },
        igdbId: { type: 'integer', minimum: 1 },
        steamAppId: { type: 'string', minLength: 1 },
        steamGridDbId: { type: 'integer', minimum: 1 },
        openLibraryId: { type: 'string', minLength: 1 },
        isbn: { type: 'string', minLength: 1 },
      },
      additionalProperties: false,
    },
  },
  required: ['ids'],
  additionalProperties: false,
} as const;

function providerFor(providers: TitleProviders, type: SearchableType) {
  const provider = providers.get(type);
  if (!provider) {
    throw ApiError.notImplemented(
      'provider_not_configured',
      `No provider is configured for ${type}`,
    );
  }
  return provider;
}

/** Provider search, adding titles, and the inbox of titles that arrived without ids. */
export function registerTitleRoutes(
  app: FastifyInstance,
  providers: TitleProviders,
  unlinked: UnlinkedTitleRepository,
  resolver: UnlinkedResolver,
): void {
  app.get<{ Querystring: { type: SearchableType; q: string; year?: number } }>(
    '/api/search',
    { schema: { querystring: searchQuery } },
    async (request): Promise<{ results: SearchResult[] }> => {
      const { type, q, year } = request.query;
      return { results: await providerFor(providers, type).search(q.trim(), year ?? null) };
    },
  );

  app.post<{ Body: AddTitleRequest }>(
    '/api/titles',
    { schema: { body: addBody } },
    async (request, reply) => {
      const { type, externalId } = request.body;
      const created: EntityRef = await providerFor(providers, type).add(externalId);
      return reply.code(201).send(created);
    },
  );

  app.get('/api/unlinked', async (): Promise<UnlinkedTitle[]> => unlinked.list());

  app.delete<{ Params: { id: number } }>(
    '/api/unlinked/:id',
    { schema: { params: idParams } },
    async (request, reply) => {
      if (!unlinked.delete(request.params.id)) throw ApiError.notFound();
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: number }; Body: ResolveUnlinkedRequest }>(
    '/api/unlinked/:id/resolve',
    { schema: { params: idParams, body: resolveBody } },
    async (request, reply): Promise<ResolveUnlinkedResponse> =>
      reply.code(201).send(await resolver.resolve(request.params.id, request.body.ids)),
  );
}
