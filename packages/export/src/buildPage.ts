import type { Artwork } from '@metrack/domain';
import type { PageContext } from './PageContext.js';
import type { Page } from './Page.js';

interface PageParts {
  section: string;
  slug: string;
  fields: Record<string, unknown>;
  review: string | null;
  artwork: Artwork;
}

/** Assembles a page, looking up its cover and banner among the stored images. */
export function buildPage(parts: PageParts, context: PageContext): Page {
  const { cover, banner } = parts.artwork;
  return {
    section: parts.section,
    slug: parts.slug,
    fields: parts.fields,
    body: parts.review,
    cover: cover === null ? null : (context.imagesByRef.get(cover) ?? null),
    banner: banner === null ? null : (context.imagesByRef.get(banner) ?? null),
  };
}
