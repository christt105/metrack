/** A finished browser-built export: the ZIP, the name to save it as and the images whose files could not be fetched. */
export interface AccountExportResult {
  blob: Blob;
  fileName: string;
  missing: string[];
}
