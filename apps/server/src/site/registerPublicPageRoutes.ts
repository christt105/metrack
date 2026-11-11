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
import { matchesEtag } from './matchesEtag.js';
import { notModified } from './notModified.js';
import type { PublicRenderCache } from './PublicRenderCache.js';
import type { PublicRenderLookup } from './PublicRenderLookup.js';
import { publicResponse } from './publicResponse.js';
import { renderEtag } from './renderEtag.js';
import { UncachedPublicRenders } from './UncachedPublicRenders.js';
import { siteOrigin } from './siteOrigin.js';

export interface PublicPageDeps {
  profiles: PublicProfileRepository;
  sources: PublicSiteSources;
  scope: UserScope;
  images?: ImageStore;
  /** Stores rendered pages and tells their version; renders every request when unset. */
  renderCache?: PublicRenderCache;
  /** Address the feed links to; the visitor's own address when unset. */
  publicUrl: string | null;
  /** Where the privacy page says to write about one's data. */
  contactEmail: string;
}

const ID = /^[1-9]\d{0,9}$/;
const HTML = 'text/html; charset=utf-8';
const JSON_TYPE = 'application/json; charset=utf-8';
const PUBLISHED_IMAGES = 'published-images';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const MAX_STORED_CHARS = 1_000_000;

/**
 * The privacy page at `/privacy` and the public pages under `/u/<handle>/`: the library home, one page per item, the statistics, the collage, the about
 * page, the index the scripts read, an RSS feed of what was finished and the images those pages show, plus the shared
 * theme files under `/u/assets/`. They need no sign-in, so they stay outside `/api`, and a page
 * exists only while its owner has a handle and has switched it on. Every other case answers with the same
 * 404, and every answer asks search engines to stay away.
 */
export function registerPublicPageRoutes(app: Hono<ApiEnv>, deps: PublicPageDeps): void {
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

  const renders = deps.renderCache ?? new UncachedPublicRenders(deps.profiles);

  const libraryOf = async (userId: number, handle: string): Promise<Library> => {
    const page = await deps.profiles.get(userId);
    return loadLibrary(deps.sources, deps.scope, userId, handle.toLowerCase(), page);
  };

  /**
   * Answers from the stored render when it is current, with 304 when the visitor already holds it, and
   * otherwise renders from the library and stores the result. A `null` render is a 404 and is never stored.
   */
  const cached = async (
    context: Context,
    cacheKey: string,
    contentType: string,
    render: (library: Library) => string | null,
  ): Promise<Response> => {
    const handle = context.req.param('handle') ?? '';
    const found = await renders.lookup(handle, cacheKey);
    if (!found?.enabled) return publicNotFound();
    const etag =
      found.version === null ? undefined : renderEtag(found.userId, found.version, cacheKey);
    if (etag !== undefined && matchesEtag(context.req.header('if-none-match') ?? null, etag)) {
      return notModified(etag, 'no-cache');
    }
    if (found.cached) {
      return publicResponse(found.cached.body, found.cached.contentType, 'no-cache', 200, etag);
    }
    const body = render(await libraryOf(found.userId, handle));
    if (body === null) return publicNotFound();
    await keep(found, cacheKey, contentType, body);
    return publicResponse(body, contentType, 'no-cache', 200, etag);
  };

  const keep = async (
    found: PublicRenderLookup,
    cacheKey: string,
    contentType: string,
    body: string,
  ): Promise<void> => {
    if (found.version === null || body.length > MAX_STORED_CHARS) return;
    try {
      await renders.store(found.userId, cacheKey, found.version, contentType, body);
    } catch {
      return;
    }
  };

  const page =
    (cacheKey: string, render: (library: Library) => string | null, type = HTML) =>
    (context: Context): Promise<Response> =>
      cached(context, cacheKey, type, render);
  const pageAt = (
    path: string,
    render: (library: Library) => string | null,
    type?: string,
  ): void => {
    const key = path === '' ? 'home' : path.slice(1);
    app.get(`/u/:handle${path}`, page(key, render, type));
    if (path !== '') app.get(`/u/:handle${path}/`, page(key, render, type));
  };
  pageAt('', renderHome);
  app.get('/u/:handle/', page('home', renderHome));
  pageAt('/stats', renderStats);
  pageAt('/collage', renderCollage);
  pageAt('/about', renderAbout);
  app.get('/u/:handle/index.json', page('index.json', renderIndex, JSON_TYPE));

  app.get('/u/:handle/feed.xml', (context) => {
    const origin = siteOrigin(context.req.raw, deps.publicUrl);
    return cached(context, `feed.xml@${origin}`, 'application/rss+xml; charset=utf-8', (library) =>
      renderFeed(library, origin),
    );
  });

  app.get('/u/:handle/images/:hash', async (context) => {
    const { handle, hash } = context.req.param();
    if (!deps.images || !isImageHash(hash)) return publicNotFound();
    const found = await renders.lookup(handle, PUBLISHED_IMAGES);
    if (!found?.enabled) return publicNotFound();
    let list = found.cached?.body;
    if (list === undefined) {
      list = JSON.stringify([...publishedImageHashes(await libraryOf(found.userId, handle))]);
      await keep(found, PUBLISHED_IMAGES, JSON_TYPE, list);
    }
    if (!list.includes(`"${hash}"`)) return publicNotFound();
    const image = await deps.images.get(hash);
    if (!image || !(await deps.images.hasFile(image))) return publicNotFound();
    return publicResponse(await deps.images.read(image), image.mimeType, IMMUTABLE);
  });

  app.get('/u/:handle/:type/:id', async (context) => {
    const { type, id } = context.req.param();
    if (!isPublicKind(type) || !ID.test(id)) return publicNotFound();
    return cached(context, `${type}/${Number(id)}`, HTML, (library) =>
      renderDetail(library, type, Number(id)),
    );
  });
}

function decodePath(path: string): string | undefined {
  try {
    return decodeURIComponent(path);
  } catch {
    return undefined;
  }
}
