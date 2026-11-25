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
    title: `${library.messages.menu.about} | ${ownerName(library)}`,
    active: 'about',
    page: `<main class="wrap narrow" aria-label="${library.messages.contentLabel}"><header class="page-head"><h1>${library.messages.menu.about}</h1></header><div class="prose">${content}</div></main>`,
  });
}
