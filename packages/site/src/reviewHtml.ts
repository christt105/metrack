import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import { linkResolver } from './linkResolver.js';
import { renderMarkdown } from './markdown/renderMarkdown.js';

/** A confirmed review as HTML, or an empty string when the item has none. */
export function reviewHtml(library: Library, entry: PublicEntry, origin = ''): string {
  if (entry.review === null || entry.review.trim() === '') return '';
  return renderMarkdown(entry.review, {
    handle: library.handle,
    origin,
    linkFor: linkResolver(library),
  });
}
