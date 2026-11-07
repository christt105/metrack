import type { ExportImage } from './ExportImage.js';
import type { Slugs } from './Slugs.js';

/** What every page builder needs besides its own entity. */
export interface PageContext {
  slugs: Slugs;
  imagesByRef: ReadonlyMap<string, ExportImage>;
  /** Stored copies by the remote URL they came from, for covers and banners that link to a provider. */
  imagesByUrl: ReadonlyMap<string, ExportImage>;
}
