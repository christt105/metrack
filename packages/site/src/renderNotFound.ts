import { es } from './messages/es.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { renderHead } from './renderHead.js';

/** The page every missing public address answers with, the same whatever is missing. */
export function renderNotFound(messages: SiteMessages = es): string {
  return `${renderHead(messages.lang, messages.notFound.title, '', false)}<body>
<main class="wrap narrow page" aria-label="${messages.contentLabel}"><h1>${messages.notFound.title}</h1><p>${messages.notFound.body}</p></main>
</body>
</html>
`;
}
