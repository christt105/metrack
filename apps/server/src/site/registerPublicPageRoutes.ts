import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  isPublicKind,
  publishedImageHashes,
  renderAbout,
  renderCollage,
  renderDetail,
  renderFeed,
  renderHome,
  renderPrivacy,
  renderIndex,
  renderStats,
  siteAsset,
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
  /** Where the privacy page says to write about one's data. */
  contactEmail: string;
}

const ID = /^[1-9]\d{0,9}$/;

/**
 * The privacy page at `/privacy` and the public pages under `/u/<handle>/`: the library home, one page per item, the statistics, the collage, the about
 * page, the index the scripts read, an RSS feed of what was finished and the images those pages show, plus the shared
 * theme files under `/u/assets/`. They need no sign-in, so they stay outside `/api`, and a page
 * exists only while its owner has a handle and has switched it on. Every other case answers with the same
 * 404, and every answer asks search engines to stay away.
 */
export function registerPublicPageRoutes(app: FastifyInstance, deps: PublicPageDeps): void {
  const libraryOf = async (handle: string): Promise<Library | undefined> => {
    const profile = await deps.profiles.findByHandle(handle);
    if (!profile?.enabled) return undefined;
    const page = await deps.profiles.get(profile.userId);
    return loadLibrary(deps.sources, deps.scope, profile.userId, handle.toLowerCase(), page);
  };

  void app.register(async (site) => {
    site.addHook('onSend', async (_request, reply, payload) => {
      void reply.header('X-Robots-Tag', 'noindex');
      return payload;
    });

    site.get('/privacy', async (_request, reply) =>
      reply
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'public, max-age=300')
        .send(renderPrivacy({ contactEmail: deps.contactEmail })),
    );

    site.get<{ Params: { '*': string } }>('/u/assets/*', async (request, reply) => {
      const asset = siteAsset(request.params['*']);
      if (!asset) return sendPublicNotFound(reply);
      return reply
        .type(asset.contentType)
        .header('Cache-Control', 'public, max-age=3600')
        .send(typeof asset.body === 'string' ? asset.body : Buffer.from(asset.body));
    });

    const page =
      (render: (library: Library) => string | null, type = 'text/html; charset=utf-8') =>
      async (request: FastifyRequest<{ Params: { handle: string } }>, reply: FastifyReply) => {
        const library = await libraryOf(request.params.handle);
        const body = library ? render(library) : null;
        if (body === null) return sendPublicNotFound(reply);
        return reply.type(type).header('Cache-Control', 'no-cache').send(body);
      };
    const pageAt = (
      path: string,
      render: (library: Library) => string | null,
      type?: string,
    ): void => {
      site.get<{ Params: { handle: string } }>(`/u/:handle${path}`, page(render, type));
      if (path !== '') {
        site.get<{ Params: { handle: string } }>(`/u/:handle${path}/`, page(render, type));
      }
    };
    pageAt('', renderHome);
    site.get<{ Params: { handle: string } }>('/u/:handle/', page(renderHome));
    pageAt('/stats', renderStats);
    pageAt('/collage', renderCollage);
    pageAt('/about', renderAbout);
    site.get<{ Params: { handle: string } }>(
      '/u/:handle/index.json',
      page(renderIndex, 'application/json; charset=utf-8'),
    );

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
