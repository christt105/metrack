import type { Library } from './Library.js';
import { linkResolver } from './linkResolver.js';
import { renderMarkdown } from './markdown/renderMarkdown.js';
import { ownerName } from './ownerName.js';
import { renderLayout } from './renderLayout.js';

/** The about page, written by the user in Markdown, or null while they have not written one. */
export function renderAbout(library: Library): string | null {
  const { about } = library.profile;
  if (about === null) return null;
  const content = renderMarkdown(about, {
    handle: library.handle,
    origin: '',
    headingOffset: 0,
    linkFor: linkResolver(library),
  });
  return renderLayout({
    library,
    title: `Acerca de | ${ownerName(library)}`,
    active: 'about',
    page: `<div class="wrapper post"><main class="page-content" aria-label="Content"><article><header class="header media-simple-header"><div class="media-simple-details"><h1 class="header-title">Acerca de</h1><div class="media-meta"></div></div></header><div class="page-content">${content}</div></article></main></div>`,
  });
}
