import type { Context, Hono } from 'hono';
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
import type { ApiEnv } from '../api/ApiEnv.js';
import { publicNotFound } from './publicNotFound.js';
import { publicResponse } from './publicResponse.js';
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
export function registerPublicPageRoutes(app: Hono<ApiEnv>, deps: PublicPageDeps): void {
  const libraryOf = async (handle: string): Promise<Library | undefined> => {
    const profile = await deps.profiles.findByHandle(handle);
    if (!profile?.enabled) return undefined;
    const page = await deps.profiles.get(profile.userId);
    return loadLibrary(deps.sources, deps.scope, profile.userId, handle.toLowerCase(), page);
  };

  app.get('/privacy', () =>
    publicResponse(
      renderPrivacy({ contactEmail: deps.contactEmail }),
      'text/html; charset=utf-8',
      'public, max-age=300',
    ),
  );

  app.get('/u/assets/*', (context) => {
    const name = decodePath(new URL(context.req.url).pathname.slice('/u/assets/'.length));
    const asset = name === undefined ? undefined : siteAsset(name);
    if (!asset) return publicNotFound();
    return publicResponse(asset.body, asset.contentType, 'public, max-age=3600');
  });

  const page =
    (render: (library: Library) => string | null, type = 'text/html; charset=utf-8') =>
    async (context: Context): Promise<Response> => {
      const library = await libraryOf(context.req.param('handle') ?? '');
      const body = library ? render(library) : null;
      if (body === null) return publicNotFound();
      return publicResponse(body, type, 'no-cache');
    };
  const pageAt = (
    path: string,
    render: (library: Library) => string | null,
    type?: string,
  ): void => {
    app.get(`/u/:handle${path}`, page(render, type));
    if (path !== '') app.get(`/u/:handle${path}/`, page(render, type));
  };
  pageAt('', renderHome);
  app.get('/u/:handle/', page(renderHome));
  pageAt('/stats', renderStats);
  pageAt('/collage', renderCollage);
  pageAt('/about', renderAbout);
  app.get('/u/:handle/index.json', page(renderIndex, 'application/json; charset=utf-8'));

  app.get('/u/:handle/feed.xml', async (context) => {
    const library = await libraryOf(context.req.param('handle'));
    if (!library) return publicNotFound();
    return publicResponse(
      renderFeed(library, siteOrigin(context.req.raw, deps.publicUrl)),
      'application/rss+xml; charset=utf-8',
      'no-cache',
    );
  });

  app.get('/u/:handle/images/:hash', async (context) => {
    const { handle, hash } = context.req.param();
    const library = await libraryOf(handle);
    if (!library || !deps.images || !isImageHash(hash)) return publicNotFound();
    if (!publishedImageHashes(library).has(hash)) return publicNotFound();
    const image = await deps.images.get(hash);
    if (!image || !(await deps.images.hasFile(image))) return publicNotFound();
    return publicResponse(await deps.images.read(image), image.mimeType, 'public, max-age=300');
  });

  app.get('/u/:handle/:type/:id', async (context) => {
    const { handle, type, id } = context.req.param();
    const library = await libraryOf(handle);
    if (!library || !isPublicKind(type) || !ID.test(id)) return publicNotFound();
    const page = renderDetail(library, type, Number(id));
    if (page === null) return publicNotFound();
    return publicResponse(page, 'text/html; charset=utf-8', 'no-cache');
  });
}

function decodePath(path: string): string | undefined {
  try {
    return decodeURIComponent(path);
  } catch {
    return undefined;
  }
}
