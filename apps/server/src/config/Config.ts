import type { BackupConfig } from '../backup/BackupConfig.js';
import type { NtfyConfig } from '../notify/NtfyConfig.js';

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  webDir: string;
  appVersion: string;
  backup: BackupConfig;
  ntfy?: NtfyConfig;
}
