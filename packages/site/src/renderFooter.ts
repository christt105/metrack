import { escapeHtml } from '@metrack/export';
import type { Library } from './Library.js';
import { feedPath } from './sitePaths.js';

const RSS_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 019 9"/><path d="M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1"/></svg>';

const UP_ICON =
  '<svg width="48" height="48" fill="currentColor" stroke="currentColor" viewBox="0 96 960 960"><path d="M283 704.739 234.261 656 480 410.261 725.739 656 677 704.739l-197-197-197 197z"/></svg>';

/** The footer with the feed link and the copyright, and the go-to-top button. */
export function renderFooter(library: Library): string {
  const year = new Date().getFullYear();
  return `<footer class="footer"><span class="footer_item"> </span>&nbsp;<div class="footer_social-icons"><a href="${escapeHtml(feedPath(library.handle))}" target="_blank" rel="noopener noreferrer me" title="Rss">${RSS_ICON}</a></div><small class="footer_copyright">© ${year} ${escapeHtml(library.handle)}. Servido por metrack.</small></footer><a href="#" title="Ir arriba" id="totop">${UP_ICON}</a>`;
}
