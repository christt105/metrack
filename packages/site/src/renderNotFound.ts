import { es } from './messages/es.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { assetPath } from './sitePaths.js';

/** The page every missing public address answers with, the same whatever is missing. */
export function renderNotFound(messages: SiteMessages = es): string {
  return `<!DOCTYPE html>
<html lang="${messages.lang}" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${messages.notFound.title}</title>
<link href="${assetPath('theme.css')}" rel="stylesheet">
<meta name="color-scheme" content="light dark">
</head>
<body data-theme="dark">
<div class="wrapper"><main aria-label="Content"><h1>${messages.notFound.title}</h1><p>${messages.notFound.body}</p></main></div>
</body>
</html>
`;
}
