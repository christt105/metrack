import type { ImageDisplay } from './ImageDisplay.js';
import { isLinkedImageUrl } from './isLinkedImageUrl.js';

const TMDB_SIZES: Record<ImageDisplay, string> = { thumb: 'w342', cover: 'w780', banner: 'w1280' };
const IGDB_SIZES: Record<ImageDisplay, string> = {
  thumb: 'cover_big',
  cover: '720p',
  banner: '1080p',
};
const TMDB_PATH = /^\/t\/p\/[^/]+\//;
const IGDB_PATH = /\/t_[a-z0-9_]+\//;

/**
 * The address to paint an image at for a given display. Linked TMDB and IGDB images are asked at the size
 * the display needs; anything else (stored copies, Steam art) is returned unchanged.
 */
export function sizedImageUrl(url: string, display: ImageDisplay): string {
  if (!isLinkedImageUrl(url)) return url;
  const parsed = new URL(url);
  if (parsed.hostname === 'image.tmdb.org' && TMDB_PATH.test(parsed.pathname)) {
    parsed.pathname = parsed.pathname.replace(TMDB_PATH, `/t/p/${TMDB_SIZES[display]}/`);
    return parsed.toString();
  }
  if (parsed.hostname === 'images.igdb.com' && IGDB_PATH.test(parsed.pathname)) {
    parsed.pathname = parsed.pathname.replace(IGDB_PATH, `/t_${IGDB_SIZES[display]}/`);
    return parsed.toString();
  }
  return url;
}
