import { escapeHtml } from '@metrack/export';
import { STYLESHEET_PATH, feedPath, homePath } from './sitePaths.js';

export interface LayoutOptions {
  title: string;
  /** The owner of the pages; without one the layout has no navigation. */
  handle?: string;
  body: string;
}

/** The shell shared by every public page. It carries no script and always asks search engines to stay away. */
export function renderLayout(options: LayoutOptions): string {
  const { handle } = options;
  const nav =
    handle === undefined
      ? ''
      : `<header class="navbar"><nav aria-label="Navegación"><a class="logo" href="${escapeHtml(homePath(handle))}">@${escapeHtml(handle)}</a><a class="feed-link" href="${escapeHtml(feedPath(handle))}">RSS</a></nav></header>`;
  const alternate =
    handle === undefined
      ? ''
      : `<link rel="alternate" type="application/rss+xml" title="Acabados" href="${escapeHtml(feedPath(handle))}">`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(options.title)}</title>
<link rel="stylesheet" href="${STYLESHEET_PATH}">
${alternate}
</head>
<body>
${nav}
<div class="wrapper">
${options.body}
</div>
<footer class="footer"><small>Servido por metrack</small></footer>
</body>
</html>
`;
}
