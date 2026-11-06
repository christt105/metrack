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
  /** Sign in as any user with no password (DEV_LOGIN=true). Only for a trusted network or development. */
  devLogin: boolean;
  tmdbApiKey: string | undefined;
  tmdbLanguage: string;
  openLibraryLanguage: string;
  steamGridDbToken: string | undefined;
  igdb?: IgdbClientOptions;
  backup: BackupConfig;
  alerts: AlertsConfig;
  ntfy?: NtfyConfig;
}
