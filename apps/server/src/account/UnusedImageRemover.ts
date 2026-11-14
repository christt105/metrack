/** Deletes the images of an erased account that nothing uses any more; an `ImageStore` is one. */
export interface UnusedImageRemover {
  /** Deletes those of the given images that are unused and that no user owns, and returns their hashes. */
  removeUnused(hashes: readonly string[]): Promise<string[]>;
}
