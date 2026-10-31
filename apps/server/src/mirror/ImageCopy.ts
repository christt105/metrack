/** A stored image the mirror has to place in the vault before a note can link to it. */
export interface ImageCopy {
  hash: string;
  /** Path relative to the mirror folder. */
  path: string;
}
