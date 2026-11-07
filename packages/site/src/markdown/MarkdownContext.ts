/** What the markdown renderer needs to turn a review into a page's HTML. */
export interface MarkdownContext {
  handle: string;
  /** Prefix for the addresses it writes; empty for pages, the site address for feeds. */
  origin: string;
  /** Where a wikilink to a file name points, when the item exists on the page. */
  linkFor: (name: string) => string | null;
}
