/** Turns stored image references into values the vault understands. */
export interface MirrorImages {
  /**
   * The front matter value for a cover or banner: `current` when it already points at the same
   * image, otherwise a remote URL or a `[[path]]` link. Null when the image cannot be placed.
   */
  propertyValue(ref: string, current: unknown): string | null;
  /** The vault path to embed in a review with `![[...]]`, or null when it cannot be placed. */
  embedPath(ref: string): string | null;
}
