import { escapeHtml } from '@metrack/export';
import type { Library } from './Library.js';

/** The giscus comments script, or nothing while the user has not set up giscus. */
export function renderComments(library: Library): string {
  const giscus = library.profile.giscus;
  if (giscus === null) return '';
  const attrs = [
    ['data-repo', giscus.repo],
    ['data-repo-id', giscus.repoId],
    ['data-category', giscus.category],
    ['data-category-id', giscus.categoryId],
    ['data-mapping', 'pathname'],
    ['data-strict', '0'],
    ['data-reactions-enabled', '1'],
    ['data-emit-metadata', '0'],
    ['data-input-position', 'bottom'],
    ['data-theme', 'preferred_color_scheme'],
    ['data-lang', 'es'],
  ]
    .map(([name, value]) => `${name}="${escapeHtml(value as string)}"`)
    .join(' ');
  return `<script src="https://giscus.app/client.js" ${attrs} crossorigin="anonymous" async></script>`;
}
