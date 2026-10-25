import type { FastifyInstance } from 'fastify';
import { COLLECTIONS, IMAGE_KINDS, type ImageChoice, type ImageKind } from '@metrack/domain';
import type { ArtworkService } from '../artwork/ArtworkService.js';
import type { MediaEditor } from '../media/MediaEditor.js';

const params = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    kind: { enum: [...IMAGE_KINDS] },
  },
  required: ['id', 'kind'],
} as const;

const body = {
  type: 'object',
  properties: { url: { type: 'string', minLength: 1 } },
  required: ['url'],
  additionalProperties: false,
} as const;

type ImageParams = { id: number; kind: ImageKind };

/** Candidate listing, choosing and removing covers and banners of every collection. */
export function registerArtworkRoutes(
  app: FastifyInstance,
  artwork: ArtworkService,
  editor: MediaEditor,
): void {
  for (const collection of COLLECTIONS) {
    const path = `/api/${collection}/:id/images/:kind`;

    app.get<{ Params: ImageParams }>(path, { schema: { params } }, async (request) =>
      artwork.candidates(collection, request.params.id, request.params.kind),
    );

    app.put<{ Params: ImageParams; Body: ImageChoice }>(
      path,
      { schema: { params, body } },
      async (request) =>
        artwork.choose(collection, request.params.id, request.params.kind, request.body.url),
    );

    app.delete<{ Params: ImageParams }>(path, { schema: { params } }, async (request) =>
      editor.clearImage(collection, request.params.id, request.params.kind),
    );
  }
}
