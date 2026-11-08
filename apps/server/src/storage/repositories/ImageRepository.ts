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
  /** Every extra URL recorded with `addSource`, with the image it yields. */
  listSources(): Promise<{ url: string; hash: string }[]>;
  /** The image first stored from this URL, or else one the URL was recorded as a source of. */
  findBySourceUrl(url: string): Promise<StoredImage | undefined>;
  /** Removes the image row, its sources and owners, and clears every cover or banner that referenced it. */
  delete(hash: string): Promise<void>;
  /**
   * Hashes of stored images nothing uses: no cover or banner points at their reference or at a URL they
   * were stored from, and no review embeds their reference.
   */
  orphans(createdBefore?: string): Promise<string[]>;
  /** Records that the user owns the image; owning it twice is a no-op. */
  addOwner(hash: string, userId: number, createdAt: string): Promise<void>;
  /** The users who own the image, none for provider images. */
  ownerIds(hash: string): Promise<number[]>;
  /** The images the user owns, oldest first. */
  ownedBy(userId: number): Promise<StoredImage[]>;
  /** Total size of the images the user owns. */
  usedBytes(userId: number): Promise<number>;
  /** Whether a shared catalog row (not someone's own entry) shows the image as its cover or banner. */
  isShownByCatalog(hash: string): Promise<boolean>;
}
