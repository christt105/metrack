import { DEFAULT_AVATAR_SVG } from './assets/DEFAULT_AVATAR_SVG.js';
import { DEFAULT_POSTER_SVG } from './assets/DEFAULT_POSTER_SVG.js';
import { FAVICON_SVG } from './assets/FAVICON_SVG.js';
import { HOST_GROTESK_LATIN_EXT_WOFF2 } from './assets/HOST_GROTESK_LATIN_EXT_WOFF2.js';
import { HOST_GROTESK_LATIN_WOFF2 } from './assets/HOST_GROTESK_LATIN_WOFF2.js';
import { SITE_JS } from './assets/SITE_JS.js';
import { TMDB_LOGO_SVG } from './assets/TMDB_LOGO_SVG.js';
import type { SiteAsset } from './SiteAsset.js';
import { siteStylesheet } from './siteStylesheet.js';

const SVG = 'image/svg+xml';

function bytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

const ASSETS = new Map<string, SiteAsset>([
  ['site.css', { contentType: 'text/css; charset=utf-8', body: siteStylesheet() }],
  ['site.js', { contentType: 'text/javascript; charset=utf-8', body: SITE_JS }],
  [
    'fonts/host-grotesk-latin.woff2',
    { contentType: 'font/woff2', body: bytes(HOST_GROTESK_LATIN_WOFF2) },
  ],
  [
    'fonts/host-grotesk-latin-ext.woff2',
    { contentType: 'font/woff2', body: bytes(HOST_GROTESK_LATIN_EXT_WOFF2) },
  ],
  ['favicon.svg', { contentType: SVG, body: FAVICON_SVG }],
  ['default-poster.svg', { contentType: SVG, body: DEFAULT_POSTER_SVG }],
  ['default-avatar.svg', { contentType: SVG, body: DEFAULT_AVATAR_SVG }],
  ['tmdb-logo.svg', { contentType: SVG, body: TMDB_LOGO_SVG }],
]);

/** The shared file served at `/u/assets/<name>`, or undefined when there is none. */
export function siteAsset(name: string): SiteAsset | undefined {
  return ASSETS.get(name);
}
