export interface ExportedTextFile {
  kind: 'text';
  /** Path relative to the export root, with forward slashes. */
  path: string;
  content: string;
}
