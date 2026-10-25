import type { FastifyInstance } from 'fastify';
import {
  COLLECTIONS,
  MEDIA_SORT_FIELDS,
  MEDIA_STATUSES,
  MEDIA_TYPES,
  type Collection,
  type MediaQuery,
  type RewatchRequest,
} from '@metrack/domain';
import type { MediaCatalog } from '../media/MediaCatalog.js';
import type { MediaEditor } from '../media/MediaEditor.js';
import { createBody, idParams, patchBody } from './schemas/mediaSchemas.js';

const listQuery = {
  type: 'object',
  properties: {
    type: { enum: [...MEDIA_TYPES] },
    status: { enum: [...MEDIA_STATUSES] },
    q: { type: 'string' },
    sort: { enum: [...MEDIA_SORT_FIELDS] },
    order: { enum: ['asc', 'desc'] },
    limit: { type: 'integer', minimum: 1, maximum: 1000 },
    offset: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const;

const dateBody = {
  type: 'object',
  properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
  required: ['date'],
  additionalProperties: false,
} as const;

/** Combined list plus read, create, edit and delete for every entity collection. */
export function registerMediaRoutes(
  app: FastifyInstance,
  editor: MediaEditor,
  catalog: MediaCatalog,
): void {
  app.get<{ Querystring: MediaQuery }>(
    '/api/media',
    { schema: { querystring: listQuery } },
    async (request) => catalog.list(request.query),
  );

  for (const collection of COLLECTIONS) registerCollection(app, editor, collection);
}

function registerCollection(
  app: FastifyInstance,
  editor: MediaEditor,
  collection: Collection,
): void {
  const base = `/api/${collection}`;

  app.get<{ Params: { id: number } }>(
    `${base}/:id`,
    { schema: { params: idParams } },
    async (request) => editor.detail(collection, request.params.id),
  );

  app.post<{ Body: Record<string, unknown> }>(
    base,
    { schema: { body: createBody(collection) } },
    async (request, reply) => reply.code(201).send(editor.create(collection, request.body)),
  );

  app.patch<{ Params: { id: number }; Body: Record<string, unknown> }>(
    `${base}/:id`,
    { schema: { params: idParams, body: patchBody(collection) } },
    async (request) => editor.patch(collection, request.params.id, request.body),
  );

  app.delete<{ Params: { id: number } }>(
    `${base}/:id`,
    { schema: { params: idParams } },
    async (request, reply) => {
      editor.remove(collection, request.params.id);
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { id: number; field: string } }>(
    `${base}/:id/edited/:field`,
    {
      schema: {
        params: { ...idParams, properties: { ...idParams.properties, field: { type: 'string' } } },
      },
    },
    async (request) => editor.unmarkEdited(collection, request.params.id, request.params.field),
  );

  if (!editor.kind(collection).trackable) return;

  app.post<{ Params: { id: number }; Body: RewatchRequest }>(
    `${base}/:id/rewatches`,
    { schema: { params: idParams, body: dateBody } },
    async (request, reply) =>
      reply.code(201).send(editor.addRewatch(collection, request.params.id, request.body.date)),
  );

  app.delete<{ Params: { id: number; date: string } }>(
    `${base}/:id/rewatches/:date`,
    {
      schema: {
        params: {
          ...idParams,
          properties: { ...idParams.properties, date: { type: 'string' } },
          required: ['id', 'date'],
        },
      },
    },
    async (request) => editor.removeRewatch(collection, request.params.id, request.params.date),
  );
}
