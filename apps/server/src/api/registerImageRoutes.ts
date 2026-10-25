import type { FastifyInstance } from 'fastify';
import { ApiError } from './ApiError.js';
import { isImageHash } from '../images/imageRef.js';
import type { ImageStore } from '../images/ImageStore.js';

export function registerImageRoutes(app: FastifyInstance, images: ImageStore): void {
  app.get<{ Params: { hash: string } }>('/api/images/:hash', async (request, reply) => {
    const image = isImageHash(request.params.hash) ? images.get(request.params.hash) : undefined;
    if (!image) throw ApiError.notFound();
    return reply
      .header('Content-Type', image.mimeType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(images.read(image));
  });

  app.delete<{ Params: { hash: string } }>('/api/images/:hash', async (request, reply) => {
    const removed = isImageHash(request.params.hash) && (await images.delete(request.params.hash));
    if (!removed) throw ApiError.notFound();
    return reply.code(204).send();
  });

  app.post('/api/images/cleanup', async () => ({ removed: await images.cleanOrphans() }));
}
