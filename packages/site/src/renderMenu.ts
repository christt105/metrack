import { escapeHtml } from '@metrack/export';
import { icon } from './icon.js';
import type { Library } from './Library.js';
import type { MenuPage } from './MenuPage.js';
import { ownerName } from './ownerName.js';
import { avatarSrc } from './avatarSrc.js';
import { aboutPath, collagePath, feedPath, homePath, statsPath } from './sitePaths.js';

function link(href: string, name: string, active: boolean): string {
  const current = active ? ' aria-current="page"' : '';
  return `<a class="site-nav-link" href="${escapeHtml(href)}"${current}>${escapeHtml(name)}</a>`;
}

/** The site header: the owner's avatar and name back to the library (left out on the library itself, whose profile shows them), the pages, and the feed. */
export function renderMenu(
  library: Library,
  active: MenuPage | null,
  profileShown: boolean,
): string {
  const { menu, footer } = library.messages;
  const home = homePath(library.handle);
  const links = [
    link(home, menu.library, active === 'home'),
    link(collagePath(library.handle), menu.collage, active === 'collage'),
    link(statsPath(library.handle), menu.stats, active === 'stats'),
    library.profile.about === null
      ? ''
      : link(aboutPath(library.handle), menu.about, active === 'about'),
  ].join('');
  const brand = profileShown
    ? ''
    : `<a class="site-brand" href="${escapeHtml(home)}"><img class="site-brand-avatar" src="${escapeHtml(avatarSrc(library))}" alt="" width="32" height="32"><span class="site-brand-name">${escapeHtml(ownerName(library))}</span></a>`;
  const modifier = profileShown ? ' site-header-inner-home' : '';
  return `<header class="site-header"><div class="site-header-inner${modifier}">${brand}<nav class="site-nav" aria-label="${menu.ariaLabel}">${links}</nav><a class="site-feed" href="${escapeHtml(feedPath(library.handle))}" title="${footer.rss}" aria-label="${footer.rss}">${icon('rss', 20)}</a></div></header>`;
}
