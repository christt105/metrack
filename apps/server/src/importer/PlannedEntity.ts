import type { ImageSource } from './ImageSource.js';
import type { InlineImage } from './InlineImage.js';

/** A row to write plus the images it should point to. */
export interface PlannedEntity<T> {
  path: string;
  entity: T;
  cover: ImageSource | null;
  banner: ImageSource | null;
  /** Images embedded in the review, imported while applying. */
  inline: InlineImage[];
}
