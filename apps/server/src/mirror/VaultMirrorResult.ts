export interface VaultMirrorResult {
  created: string[];
  updated: string[];
  unchanged: number;
  /** Notes the mirror wrote before that no longer belong to any item. */
  removed: string[];
  /** Images written into the vault so notes can link to them. */
  copiedImages: string[];
  /** Notes left alone because their front matter could not be read. */
  skipped: { path: string; reason: string }[];
  /** Notes in the mirror folders that the mirror did not write and does not touch. */
  unmanaged: string[];
}
