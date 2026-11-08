import { BANNER_JS } from './assets/BANNER_JS.js';
import { CODE_HIGHLIGHT_CSS } from './assets/CODE_HIGHLIGHT_CSS.js';
import { COLLAGE_CSS } from './assets/COLLAGE_CSS.js';
import { COLLAGE_JS } from './assets/COLLAGE_JS.js';
import { DEFAULT_AVATAR_SVG } from './assets/DEFAULT_AVATAR_SVG.js';
import { DEFAULT_POSTER_WEBP } from './assets/DEFAULT_POSTER_WEBP.js';
import { FAVICON_16X16_PNG } from './assets/FAVICON_16X16_PNG.js';
import { FAVICON_32X32_PNG } from './assets/FAVICON_32X32_PNG.js';
import { FILTER_JS } from './assets/FILTER_JS.js';
import { FONT_AWESOME_BRANDS_WOFF2 } from './assets/FONT_AWESOME_BRANDS_WOFF2.js';
import { FONT_AWESOME_CSS } from './assets/FONT_AWESOME_CSS.js';
import { FONT_AWESOME_SOLID_WOFF2 } from './assets/FONT_AWESOME_SOLID_WOFF2.js';
import { HTML2CANVAS_PRO_JS } from './assets/HTML2CANVAS_PRO_JS.js';
import { MAIN_JS } from './assets/MAIN_JS.js';
import { METRACK_CSS } from './assets/METRACK_CSS.js';
import { ROBOTO_WOFF2 } from './assets/ROBOTO_WOFF2.js';
import { STATS_JS } from './assets/STATS_JS.js';
import { THEME_CSS } from './assets/THEME_CSS.js';
import { THEME_JS } from './assets/THEME_JS.js';
import { YEAR_NAV_JS } from './assets/YEAR_NAV_JS.js';
import type { SiteAsset } from './SiteAsset.js';

const JS = 'text/javascript; charset=utf-8';
const CSS = 'text/css; charset=utf-8';

function bytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

const ASSETS = new Map<string, SiteAsset>([
  ['theme.css', { contentType: CSS, body: THEME_CSS }],
  ['fontawesome.css', { contentType: CSS, body: FONT_AWESOME_CSS }],
  [
    'fonts/fontawesome/fa-solid-900.woff2',
    { contentType: 'font/woff2', body: bytes(FONT_AWESOME_SOLID_WOFF2) },
  ],
  [
    'fonts/fontawesome/fa-brands-400.woff2',
    { contentType: 'font/woff2', body: bytes(FONT_AWESOME_BRANDS_WOFF2) },
  ],
  ['code-highlight.css', { contentType: CSS, body: CODE_HIGHLIGHT_CSS }],
  ['metrack.css', { contentType: CSS, body: METRACK_CSS }],
  ['collage.css', { contentType: CSS, body: COLLAGE_CSS }],
  [
    'fonts/Roboto/roboto-v30-latin-regular.woff2',
    { contentType: 'font/woff2', body: bytes(ROBOTO_WOFF2) },
  ],
  ['theme.js', { contentType: JS, body: THEME_JS }],
  ['main.js', { contentType: JS, body: MAIN_JS }],
  ['filter.js', { contentType: JS, body: FILTER_JS }],
  ['year-nav.js', { contentType: JS, body: YEAR_NAV_JS }],
  ['banner.js', { contentType: JS, body: BANNER_JS }],
  ['stats.js', { contentType: JS, body: STATS_JS }],
  ['html2canvas-pro.js', { contentType: JS, body: HTML2CANVAS_PRO_JS }],
  ['collage.js', { contentType: JS, body: COLLAGE_JS }],
  ['default-poster.webp', { contentType: 'image/webp', body: bytes(DEFAULT_POSTER_WEBP) }],
  ['default-avatar.svg', { contentType: 'image/svg+xml', body: DEFAULT_AVATAR_SVG }],
  ['favicon-16x16.png', { contentType: 'image/png', body: bytes(FAVICON_16X16_PNG) }],
  ['favicon-32x32.png', { contentType: 'image/png', body: bytes(FAVICON_32X32_PNG) }],
]);

/** The shared file served at `/u/assets/<name>`, or undefined when there is none. */
export function siteAsset(name: string): SiteAsset | undefined {
  return ASSETS.get(name);
}
