import { renderMarkdown } from '@metrack/site/markdown';

/**
 * A review as sanitized HTML for the signed-in app: stored images load from the private image
 * route and legacy `[[wikilinks]]` become their plain display name.
 */
export function renderReview(review: string): string {
  return renderMarkdown(review, {
    handle: '',
    origin: '',
    imagePath: (hash) => `/api/images/${hash}`,
    linkFor: () => null,
  });
}
