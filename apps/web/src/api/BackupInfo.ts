/** A stored backup as listed by the backups API. */
export interface BackupInfo {
  name: string;
  createdAt: string;
  sizeBytes: number;
  hasImages: boolean;
}
