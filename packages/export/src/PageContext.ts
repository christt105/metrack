import type { ExportImage } from './ExportImage.js';
import type { Slugs } from './Slugs.js';

/** What every page builder needs besides its own entity. */
export interface PageContext {
  slugs: Slugs;
  imagesByRef: ReadonlyMap<string, ExportImage>;
}
