/** What the markdown renderer needs to turn a review into a page's HTML. */
export interface MarkdownContext {
  handle: string;
  /** Prefix for the addresses it writes; empty for pages, the site address for feeds. */
  origin: string;
  /** Where a wikilink to a file name points, when the item exists on the page. */
  /** How many levels headings move down; reviews sit under the item's own title, so they default to 1. */
  headingOffset?: number;
  linkFor: (name: string) => string | null;
}
