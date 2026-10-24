import type { ImageSource } from './ImageSource.js';

/** A row to write plus the images it should point to. */
export interface PlannedEntity<T> {
  path: string;
  entity: T;
  cover: ImageSource | null;
  banner: ImageSource | null;
}
