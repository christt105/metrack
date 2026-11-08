import { escapeHtml } from '@metrack/export';
import type { Library } from './Library.js';
import { ownerName } from './ownerName.js';
import { renderFooter } from './renderFooter.js';
import { renderMenu, type MenuPage } from './renderMenu.js';
import { assetPath, feedPath, indexPath } from './sitePaths.js';

export interface LayoutOptions {
  library: Library;
  title: string;
  description?: string;
  active: MenuPage | null;
  /** Markup between the navigation bar and the page, such as the hero banner. */
  beforePage?: string;
  /** The page itself. */
  page: string;
  /** Names of the shared scripts the page needs, loaded after the footer. */
  scripts?: string[];
  /** Names of extra shared stylesheets. */
  styles?: string[];
  /** Markup for the end of the head, such as a script that must load first. */
  headExtra?: string;
}

const FONT_AWESOME = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';

/** The shell shared by every public page, after the Hugo theme: dark by default, always asking search engines to stay away. */
export function renderLayout(options: LayoutOptions): string {
  const { library } = options;
  const description = options.description ?? library.profile.description;
  const styles = ['theme.css', 'code-highlight.css', ...(options.styles ?? [])]
    .map((name) => `<link href="${assetPath(name)}" rel="stylesheet">`)
    .join('\n');
  const scripts = ['main.js', ...(options.scripts ?? [])]
    .map((name) => `<script src="${assetPath(name)}"></script>`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(options.title)}</title>
${description === null ? '' : `<meta name="description" content="${escapeHtml(description)}">\n`}<meta name="application-name" content="${escapeHtml(ownerName(library))}">
<link href="${escapeHtml(feedPath(library.handle))}" rel="alternate" type="application/rss+xml" title="${escapeHtml(ownerName(library))}">
${styles}
<link rel="icon" type="image/png" sizes="32x32" href="${assetPath('favicon-32x32.png')}">
<link rel="icon" type="image/png" sizes="16x16" href="${assetPath('favicon-16x16.png')}">
<meta name="theme-color" content="#434648">
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="${FONT_AWESOME}">
${options.headExtra ?? ''}</head>
<body data-theme="dark" class="notransition" data-index="${escapeHtml(indexPath(library.handle))}">
<script src="${assetPath('theme.js')}"></script>
${renderMenu(library, options.active)}
${options.beforePage ?? ''}${options.page}
${renderFooter(library)}
${scripts}
</body>
</html>
`;
}
