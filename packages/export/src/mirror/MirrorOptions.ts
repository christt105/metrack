import type { ExistingNote } from './ExistingNote.js';
import type { MirrorImages } from './MirrorImages.js';

export interface MirrorOptions {
  /** Notes already in the mirror folder, by path relative to it. */
  existing: ReadonlyMap<string, ExistingNote>;
  images: MirrorImages;
  /** Address of the metrack web app, for the link back to each item. Null leaves it out. */
  webUrl: string | null;
}
