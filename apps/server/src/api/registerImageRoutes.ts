import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import { noContent } from './noContent.js';
import type { ImageUsage, UploadedImage } from '@metrack/domain';
import { bytesBody } from './bytesBody.js';
import { ApiError } from './ApiError.js';
import { requireUser } from './requireUser.js';
import { isImageHash } from '../images/imageRef.js';
import type { ImageStore } from '../images/ImageStore.js';

const UPLOAD_TYPES = /^(image\/[a-z0-9.+-]+|application\/octet-stream)$/i;

export function registerImageRoutes(routes: ApiRoutes, images: ImageStore): void {
  routes.post<{ Body: Uint8Array | undefined }>(
    '/api/images',
    { bodyLimit: images.maxUploadBytes, rawBodyTypes: UPLOAD_TYPES, config: { trustedOnly: true } },
    async (request) => {
      if (!(request.body instanceof Uint8Array) || request.body.byteLength === 0) {
        throw ApiError.badRequest('unsupported_image', 'Send the image file as the request body');
      }
      const user = requireUser(request.user);
      const image = await images.upload(request.body, user.id, user.role === 'owner');
      const uploaded: UploadedImage = {
        ref: image.ref,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        byteSize: image.byteSize,
        usage: await images.usage(user.id, user.role === 'owner'),
      };
      return jsonResponse(uploaded, 201);
    },
  );

  routes.get('/api/images/usage', async (request): Promise<ImageUsage> => {
    const user = requireUser(request.user);
    return images.usage(user.id, user.role === 'owner');
  });

  routes.get<{ Params: { hash: string } }>('/api/images/:hash', async (request) => {
    const { hash } = request.params;
    const image = isImageHash(hash) ? await images.get(hash) : undefined;
    if (!image || !(await images.canRead(hash, requireUser(request.user)))) {
      throw ApiError.notFound();
    }
    return new Response(bytesBody(await images.read(image)), {
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  });

  routes.delete<{ Params: { hash: string } }>(
    '/api/images/:hash',
    { config: { ownerOnly: true } },
    async (request) => {
      const removed =
        isImageHash(request.params.hash) && (await images.delete(request.params.hash));
      if (!removed) throw ApiError.notFound();
      return noContent();
    },
  );

  routes.post('/api/images/cleanup', { config: { ownerOnly: true } }, async () => ({
    removed: await images.cleanOrphans(),
  }));
}
