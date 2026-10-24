import type { ExportImage } from './ExportImage.js';

/** One content bundle before rendering: its folder, front matter, body and images. */
export interface Page {
  section: string;
  slug: string;
  fields: Record<string, unknown>;
  body: string | null;
  /** Cover and banner, which are named in the front matter. */
  cover: ExportImage | null;
  banner: ExportImage | null;
}
