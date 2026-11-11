/** One image in the account export; `file` is its path inside the archive, or null when there are no bytes. */
export interface AccountExportImage {
  hash: string;
  file: string | null;
  [field: string]: unknown;
}

/** The part of the account export JSON the browser reads before it packs it; everything else is kept as is. */
export interface AccountExportData {
  exportedAt: string;
  user: { id: number };
  images: AccountExportImage[];
  [field: string]: unknown;
}
