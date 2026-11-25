import { escapeHtml } from '@metrack/export';
import type { Library } from './Library.js';
import type { MenuPage } from './MenuPage.js';
import { ownerName } from './ownerName.js';
import { renderFooter } from './renderFooter.js';
import { renderHead } from './renderHead.js';
import { iconSprite } from './icon.js';
import { renderMenu } from './renderMenu.js';
import { feedPath } from './sitePaths.js';

export interface LayoutOptions {
  library: Library;
  title: string;
  description?: string;
  active: MenuPage | null;
  /** The page itself, between the header and the footer. */
  page: string;
  /** Data the shared script reads, written into the page as JSON. */
  data?: unknown;
}

/** The shell shared by every page of a user: dark, always asking search engines to stay away. */
export function renderLayout(options: LayoutOptions): string {
  const { library } = options;
  const description = options.description ?? library.profile.description;
  const data =
    options.data === undefined
      ? ''
      : `<script type="application/json" id="site-data">${JSON.stringify(options.data).replace(/</g, '\\u003c')}</script>\n`;
  const extra = `${description === null ? '' : `<meta name="description" content="${escapeHtml(description)}">\n`}<meta name="application-name" content="${escapeHtml(ownerName(library))}">
<link href="${escapeHtml(feedPath(library.handle))}" rel="alternate" type="application/rss+xml" title="${escapeHtml(ownerName(library))}">
`;
  return `${renderHead(library.messages.lang, options.title, extra)}<body>
${iconSprite()}
${renderMenu(library, options.active)}
${options.page}
${renderFooter(library)}
${data}</body>
</html>
`;
}
