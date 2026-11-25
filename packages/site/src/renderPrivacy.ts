import { escapeHtml } from '@metrack/export';
import type { PrivacyOptions } from './PrivacyOptions.js';
import { es } from './messages/es.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { renderHead } from './renderHead.js';
import { assetPath } from './sitePaths.js';

/** The privacy page: what is stored and where, why, how to export and delete it, how long it is kept, and the data sources' credits. */
export function renderPrivacy(options: PrivacyOptions, messages: SiteMessages = es): string {
  const email = escapeHtml(options.contactEmail);
  const body = messages.privacy.body(email, assetPath('tmdb-logo.svg'));
  return `${renderHead(messages.lang, messages.privacy.title, '', false)}<body>
<main class="wrap narrow page prose" aria-label="${messages.contentLabel}">
${body}
<p class="note">${messages.privacy.servedBy}</p>
</main>
</body>
</html>
`;
}
