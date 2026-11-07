import type { Artwork } from '@metrack/domain';
import type { PageContext } from './PageContext.js';
import type { Page } from './Page.js';
import type { ExportImage } from './ExportImage.js';

interface PageParts {
  section: string;
  slug: string;
  fields: Record<string, unknown>;
  review: string | null;
  artwork: Artwork;
}

/** Assembles a page, looking up its cover and banner among the stored images, by reference or linked URL. */
export function buildPage(parts: PageParts, context: PageContext): Page {
  const { cover, banner } = parts.artwork;
  return {
    section: parts.section,
    slug: parts.slug,
    fields: parts.fields,
    body: parts.review,
    cover: cover === null ? null : imageOf(cover, context),
    banner: banner === null ? null : imageOf(banner, context),
  };
}

function imageOf(value: string, context: PageContext): ExportImage | null {
  return context.imagesByRef.get(value) ?? context.imagesByUrl.get(value) ?? null;
}
