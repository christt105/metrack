export interface BackupConfig {
  enabled: boolean;
  dir: string;
  retention: number;
  intervalHours: number;
}
