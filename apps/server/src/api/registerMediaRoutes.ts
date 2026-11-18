import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import { noContent } from './noContent.js';
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
import { ApiError } from './ApiError.js';
import { DATE_PATTERN, nullableDate } from './schemas/fieldTypes.js';
import { matchesEtag } from '../site/matchesEtag.js';
import type { ContentVersions } from '../site/ContentVersions.js';
import { mediaListEtag } from './mediaListEtag.js';
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

const patchQuery = {
  type: 'object',
  properties: { forAll: { type: 'boolean' } },
  additionalProperties: false,
} as const;

const dateBody = {
  type: 'object',
  properties: {
    date: { type: 'string', pattern: DATE_PATTERN },
    startedAt: nullableDate,
    finishedAt: { type: 'string', pattern: DATE_PATTERN },
  },
  additionalProperties: false,
} as const;

/**
 * Combined list plus read, create, edit and delete for every entity collection, except that a season is never
 * created by hand: seasons come from the TMDB ordering and the Jellyfin sync. Only the owner may pass `forAll` to change a catalog field other users hold too. With content versions the list
 * carries an ETag and answers 304 to a matching `If-None-Match` without reading the library.
 */
export function registerMediaRoutes(
  routes: ApiRoutes,
  editor: MediaEditor,
  catalog: MediaCatalog,
  list?: { versions: ContentVersions; appVersion: string },
): void {
  routes.get<{ Querystring: MediaQuery }>(
    '/api/media',
    { schema: { querystring: listQuery } },
    async (request) => {
      if (!list || !request.user) return catalog.list(request.query);
      const etag = await mediaListEtag(
        list.appVersion,
        request.user.id,
        await list.versions.global(),
        request.query,
      );
      const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' };
      if (matchesEtag(request.headers.get('if-none-match'), etag)) {
        return new Response(null, { status: 304, headers });
      }
      const response = jsonResponse(await catalog.list(request.query));
      for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      return response;
    },
  );

  for (const collection of COLLECTIONS) registerCollection(routes, editor, collection);
}

function registerCollection(routes: ApiRoutes, editor: MediaEditor, collection: Collection): void {
  const base = `/api/${collection}`;

  routes.get<{ Params: { id: number } }>(
    `${base}/:id`,
    { schema: { params: idParams } },
    async (request) => editor.detail(collection, request.params.id),
  );

  if (collection !== 'seasons') {
    routes.post<{ Body: Record<string, unknown> }>(
      base,
      { config: { trustedOnly: true }, schema: { body: createBody(collection) } },
      async (request) => jsonResponse(await editor.create(collection, request.body), 201),
    );
  }

  routes.patch<{
    Params: { id: number };
    Querystring: { forAll?: boolean };
    Body: Record<string, unknown>;
  }>(
    `${base}/:id`,
    { schema: { params: idParams, querystring: patchQuery, body: patchBody(collection) } },
    async (request) =>
      editor.patch(collection, request.params.id, request.body, {
        allowSharedCatalog: request.query.forAll === true && request.user?.role === 'owner',
      }),
  );

  routes.delete<{ Params: { id: number } }>(
    `${base}/:id`,
    { schema: { params: idParams } },
    async (request) => {
      await editor.remove(collection, request.params.id);
      return noContent();
    },
  );

  routes.delete<{ Params: { id: number; field: string } }>(
    `${base}/:id/edited/:field`,
    {
      schema: {
        params: { ...idParams, properties: { ...idParams.properties, field: { type: 'string' } } },
      },
    },
    async (request) => editor.unmarkEdited(collection, request.params.id, request.params.field),
  );

  if (!editor.kind(collection).trackable) return;

  routes.post<{ Params: { id: number }; Body: RewatchRequest }>(
    `${base}/:id/rewatches`,
    { schema: { params: idParams, body: dateBody } },
    async (request) => {
      const { date, finishedAt, startedAt } = request.body;
      const finish = finishedAt ?? date;
      if (finish === undefined) {
        throw ApiError.badRequest('invalid_date', 'A rewatch needs date or finishedAt');
      }
      return jsonResponse(
        await editor.addRewatch(collection, request.params.id, finish, startedAt ?? null),
        201,
      );
    },
  );

  routes.delete<{ Params: { id: number; date: string } }>(
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
