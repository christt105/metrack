import { escapeHtml } from '@metrack/export';
import type { Library } from './Library.js';
import type { MenuPage } from './MenuPage.js';
import type { ShareCard } from './ShareCard.js';
import { shortText } from './shortText.js';
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
  /** Whether the page already shows the owner's avatar and name, so the header leaves them out. */
  profileShown?: boolean;
  /** The page itself, between the header and the footer. */
  page: string;
  /** Data the shared script reads, written into the page as JSON. */
  data?: unknown;
  /** The picture shown when the page is shared, for pages about one item. */
  share?: ShareCard;
}

const SHARE_TEXT_LIMIT = 300;

function shareTags(options: LayoutOptions, description: string | null): string {
  const tags: [string, string][] = [
    ['og:type', 'website'],
    ['og:site_name', ownerName(options.library)],
    ['og:title', options.title],
  ];
  if (description !== null) tags.push(['og:description', description]);
  const image = options.share?.image ?? null;
  if (image !== null) tags.push(['og:image', image]);
  const card = image !== null && options.share?.wide === true ? 'summary_large_image' : 'summary';
  return [
    ...tags.map(
      ([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}">\n`,
    ),
    `<meta name="twitter:card" content="${card}">\n`,
  ].join('');
}

/** The shell shared by every page of a user: dark, always asking search engines to stay away. */
export function renderLayout(options: LayoutOptions): string {
  const { library } = options;
  const full = options.description ?? library.profile.description;
  const description = full === null ? null : shortText(full, SHARE_TEXT_LIMIT);
  const data =
    options.data === undefined
      ? ''
      : `<script type="application/json" id="site-data">${JSON.stringify(options.data).replace(/</g, '\\u003c')}</script>\n`;
  const extra = `${description === null ? '' : `<meta name="description" content="${escapeHtml(description)}">\n`}<meta name="application-name" content="${escapeHtml(ownerName(library))}">
${shareTags(options, description)}<link href="${escapeHtml(feedPath(library.handle))}" rel="alternate" type="application/rss+xml" title="${escapeHtml(ownerName(library))}">
`;
  return `${renderHead(library.messages.lang, options.title, extra)}<body>
${iconSprite()}
${renderMenu(library, options.active, options.profileShown === true)}
${options.page}
${renderFooter(library)}
${data}</body>
</html>
`;
}
