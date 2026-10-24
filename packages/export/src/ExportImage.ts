/** A stored image an exported page may use. */
export interface ExportImage {
  /** The reference entities and reviews use for the image. */
  ref: string;
  hash: string;
  extension: string;
  /** The remote address the image was fetched from, when known. */
  sourceUrl: string | null;
}
