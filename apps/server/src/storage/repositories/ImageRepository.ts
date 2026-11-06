import type { StoredImage } from '../../images/StoredImage.js';

/** The rows that describe stored images and the extra URLs each one was seen at. */
export interface ImageRepository {
  get(hash: string): Promise<StoredImage | undefined>;
  /** Oldest first. */
  list(): Promise<StoredImage[]>;
  /** Inserts the row unless that hash is already stored. */
  insert(image: StoredImage): Promise<void>;
  /** Records another URL that yields an already stored image. */
  addSource(url: string, hash: string): Promise<void>;
  /** The image first stored from this URL, or else one the URL was recorded as a source of. */
  findBySourceUrl(url: string): Promise<StoredImage | undefined>;
  /** Removes the image row and its sources, and clears every cover or banner that referenced it. */
  delete(hash: string): Promise<void>;
  /** Hashes of stored images that no entity references. */
  orphans(): Promise<string[]>;
}
