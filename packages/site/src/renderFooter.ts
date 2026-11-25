import { escapeHtml } from '@metrack/export';
import type { Library } from './Library.js';
import { assetPath } from './sitePaths.js';

const REPOSITORY = 'https://github.com/christt105/metrack';

const TMDB_URL = 'https://www.themoviedb.org';

/** The footer with the copyright, the link to metrack and the TMDB attribution. */
export function renderFooter(library: Library): string {
  const { messages } = library;
  const year = new Date().getFullYear();
  return `<footer class="site-footer"><div class="site-footer-inner"><p>© ${year} ${escapeHtml(library.handle)}. ${messages.footer.servedBy(`<a href="${REPOSITORY}" target="_blank" rel="noopener noreferrer">metrack</a>`)}</p><p class="site-credits"><a href="${TMDB_URL}" target="_blank" rel="noopener noreferrer" title="TMDB"><img src="${assetPath('tmdb-logo.svg')}" alt="TMDB" width="81" height="10"></a> ${messages.footer.tmdbNotice}</p></div></footer>`;
}
