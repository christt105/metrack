import { convertBody } from './convertBody.js';
import type { ExportedFile } from './ExportedFile.js';
import type { ExportImage } from './ExportImage.js';
import { imageFileName } from './imageFileName.js';
import type { Page } from './Page.js';
import type { PageContext } from './PageContext.js';
import { renderFrontmatter } from './renderFrontmatter.js';

/** Renders one page into its `index.md` and the image files that sit beside it. */
export function renderPage(page: Page, context: PageContext): ExportedFile[] {
  const folder = `content/${page.section}/${page.slug}`;
  const body =
    page.body === null ? null : convertBody(page.body, context.slugs.all, context.imagesByRef);
  const fields = {
    ...page.fields,
    image: page.cover === null ? null : imageFileName(page.cover),
    banner_image: page.banner === null ? null : imageFileName(page.banner),
  };
  const text = `${renderFrontmatter(fields)}${body ? `\n${body.text.trim()}\n` : ''}`;

  const used = new Map<string, ExportImage>();
  for (const image of [page.cover, page.banner, ...(body?.images ?? [])]) {
    if (image !== null) used.set(imageFileName(image), image);
  }
  return [
    { kind: 'text', path: `${folder}/index.md`, content: text },
    ...[...used].map(([name, image]): ExportedFile => ({
      kind: 'image',
      path: `${folder}/${name}`,
      hash: image.hash,
    })),
  ];
}
