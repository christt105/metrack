export interface ExportedImageFile {
  kind: 'image';
  /** Path relative to the export root, with forward slashes. */
  path: string;
  /** Hash of the stored image whose bytes belong at `path`. */
  hash: string;
}
