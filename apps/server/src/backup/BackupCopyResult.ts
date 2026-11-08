export interface BackupCopyResult {
  /** Backups whose database was copied in this run. */
  copied: string[];
  /** Images added to the copy in this run. */
  images: number;
  /** Copied databases removed by retention. */
  pruned: string[];
  /** Images removed from the copy because no retained database lists them any more. */
  prunedImages: number;
}
