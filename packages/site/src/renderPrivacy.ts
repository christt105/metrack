import { escapeHtml } from '@metrack/export';
import type { PrivacyOptions } from './PrivacyOptions.js';
import { es } from './messages/es.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { assetPath } from './sitePaths.js';

/** The privacy page: what is stored and where, why, how to export and delete it, how long it is kept, and the data sources' credits. */
export function renderPrivacy(options: PrivacyOptions, messages: SiteMessages = es): string {
  const email = escapeHtml(options.contactEmail);
  const body = messages.privacy.body(email, assetPath('tmdb-logo.svg'));
  return `<!DOCTYPE html>
<html lang="${messages.lang}" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>${messages.privacy.title}</title>
<link href="${assetPath('theme.css')}" rel="stylesheet">
</head>
<body data-theme="dark">
<div style="max-width: 760px; margin: 0 auto; padding: 20px">
${body}
<p><small>${messages.privacy.servedBy}</small></p>
</div>
</body>
</html>
`;
}
