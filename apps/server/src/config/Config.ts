import type { BackupConfig } from '../backup/BackupConfig.js';
import type { AlertsConfig } from './AlertsConfig.js';
import type { NtfyConfig } from '../notify/NtfyConfig.js';
import type { IgdbClientOptions } from '../providers/igdb/IgdbClientOptions.js';

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  webDir: string;
  appVersion: string;
  tmdbApiKey: string | undefined;
  tmdbLanguage: string;
  steamGridDbToken: string | undefined;
  igdb?: IgdbClientOptions;
  backup: BackupConfig;
  alerts: AlertsConfig;
  ntfy?: NtfyConfig;
}
