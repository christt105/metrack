import type { BackupCopyConfig } from './BackupCopyConfig.js';

export interface BackupConfig {
  enabled: boolean;
  dir: string;
  retention: number;
  intervalHours: number;
  copy?: BackupCopyConfig;
}
