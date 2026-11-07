export interface BackupCopyConfig {
  /** Folder on another disk that receives a copy of every backup. */
  dir: string;
  /** Number of copied databases to keep. Images are never removed from the copy. */
  retention: number;
}
