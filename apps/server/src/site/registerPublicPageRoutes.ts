import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  SITE_CSS,
  isPublicKind,
  publishedImageHashes,
  renderDetail,
  renderFeed,
  renderHome,
  type Library,
} from '@metrack/site';
import { isImageHash } from '../images/imageRef.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import type { UserScope } from '../users/UserScope.js';
import { loadLibrary } from './loadLibrary.js';
import type { PublicSiteSources } from './PublicSiteSources.js';
import { sendPublicNotFound } from './sendPublicNotFound.js';
import { siteOrigin } from './siteOrigin.js';

export interface PublicPageDeps {
  profiles: PublicProfileRepository;
  sources: PublicSiteSources;
  scope: UserScope;
  images?: ImageStore;
  /** Address the feed links to; the visitor's own address when unset. */
  publicUrl: string | null;
}

const ID = /^[1-9]\d{0,9}$/;

/**
 * The public pages under `/u/<handle>/`: the library home, one page per item, an RSS feed of what was
 * finished and the images those pages show. They need no sign-in, so they stay outside `/api`, and a page
 * exists only while its owner has a handle and has switched it on. Every other case answers with the same
 * 404, and every answer asks search engines to stay away.
 */
export function registerPublicPageRoutes(app: FastifyInstance, deps: PublicPageDeps): void {
  const libraryOf = async (handle: string): Promise<Library | undefined> => {
    const profile = await deps.profiles.findByHandle(handle);
    if (!profile?.enabled) return undefined;
    return loadLibrary(deps.sources, deps.scope, profile.userId, handle.toLowerCase());
  };

  void app.register(async (site) => {
    site.addHook('onSend', async (_request, reply, payload) => {
      void reply.header('X-Robots-Tag', 'noindex');
      return payload;
    });

    site.get('/u/assets/site.css', async (_request, reply) =>
      reply
        .type('text/css; charset=utf-8')
        .header('Cache-Control', 'public, max-age=3600')
        .send(SITE_CSS),
    );

    const home = async (
      request: FastifyRequest<{ Params: { handle: string } }>,
      reply: FastifyReply,
    ) => {
      const library = await libraryOf(request.params.handle);
      if (!library) return sendPublicNotFound(reply);
      return reply
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'no-cache')
        .send(renderHome(library));
    };
    site.get<{ Params: { handle: string } }>('/u/:handle', home);
    site.get<{ Params: { handle: string } }>('/u/:handle/', home);

    site.get<{ Params: { handle: string } }>('/u/:handle/feed.xml', async (request, reply) => {
      const library = await libraryOf(request.params.handle);
      if (!library) return sendPublicNotFound(reply);
      return reply
        .type('application/rss+xml; charset=utf-8')
        .header('Cache-Control', 'no-cache')
        .send(renderFeed(library, siteOrigin(request, deps.publicUrl)));
    });

    site.get<{ Params: { handle: string; type: string; id: string } }>(
      '/u/:handle/:type/:id',
      async (request, reply) => {
        const { handle, type, id } = request.params;
        const library = await libraryOf(handle);
        if (!library || !isPublicKind(type) || !ID.test(id)) return sendPublicNotFound(reply);
        const page = renderDetail(library, type, Number(id));
        if (page === null) return sendPublicNotFound(reply);
        return reply
          .type('text/html; charset=utf-8')
          .header('Cache-Control', 'no-cache')
          .send(page);
      },
    );

    site.get<{ Params: { handle: string; hash: string } }>(
      '/u/:handle/images/:hash',
      async (request, reply) => {
        const { handle, hash } = request.params;
        const library = await libraryOf(handle);
        if (!library || !deps.images || !isImageHash(hash)) return sendPublicNotFound(reply);
        if (!publishedImageHashes(library).has(hash)) return sendPublicNotFound(reply);
        const image = await deps.images.get(hash);
        if (!image || !(await deps.images.hasFile(image))) return sendPublicNotFound(reply);
        return reply
          .type(image.mimeType)
          .header('Cache-Control', 'public, max-age=300')
          .send(await deps.images.read(image));
      },
    );
  });
}
