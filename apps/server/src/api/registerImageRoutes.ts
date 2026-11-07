import type { FastifyInstance } from 'fastify';
import type { ImageUsage, UploadedImage } from '@metrack/domain';
import { ApiError } from './ApiError.js';
import { requireUser } from './requireUser.js';
import { isImageHash } from '../images/imageRef.js';
import type { ImageStore } from '../images/ImageStore.js';
import './fastifyTypes.js';

const UPLOAD_TYPES = /^(image\/[a-z0-9.+-]+|application\/octet-stream)$/i;

export function registerImageRoutes(app: FastifyInstance, images: ImageStore): void {
  app.addContentTypeParser(UPLOAD_TYPES, { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.post<{ Body: Buffer }>(
    '/api/images',
    { bodyLimit: images.maxUploadBytes },
    async (request, reply) => {
      if (!Buffer.isBuffer(request.body) || request.body.byteLength === 0) {
        throw ApiError.badRequest('unsupported_image', 'Send the image file as the request body');
      }
      const user = requireUser(request.user);
      const image = await images.upload(new Uint8Array(request.body), user.id);
      const uploaded: UploadedImage = {
        ref: image.ref,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        byteSize: image.byteSize,
        usage: await images.usage(user.id),
      };
      return reply.code(201).send(uploaded);
    },
  );

  app.get('/api/images/usage', async (request): Promise<ImageUsage> =>
    images.usage(requireUser(request.user).id),
  );

  app.get<{ Params: { hash: string } }>('/api/images/:hash', async (request, reply) => {
    const { hash } = request.params;
    const image = isImageHash(hash) ? await images.get(hash) : undefined;
    if (!image || !(await images.canRead(hash, requireUser(request.user)))) {
      throw ApiError.notFound();
    }
    return reply
      .header('Content-Type', image.mimeType)
      .header('Cache-Control', 'private, max-age=31536000, immutable')
      .send(await images.read(image));
  });

  app.delete<{ Params: { hash: string } }>(
    '/api/images/:hash',
    { config: { ownerOnly: true } },
    async (request, reply) => {
      const removed =
        isImageHash(request.params.hash) && (await images.delete(request.params.hash));
      if (!removed) throw ApiError.notFound();
      return reply.code(204).send();
    },
  );

  app.post('/api/images/cleanup', { config: { ownerOnly: true } }, async () => ({
    removed: await images.cleanOrphans(),
  }));
}
