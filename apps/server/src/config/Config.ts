import type { BackupConfig } from '../backup/BackupConfig.js';
import type { AlertsConfig } from './AlertsConfig.js';
import type { NtfyConfig } from '../notify/NtfyConfig.js';
import type { NtfyServer } from '../notify/NtfyServer.js';
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
  /** Instance alerts, such as failed backups. */
  ntfy?: NtfyConfig;
  /** Where each user's alerts go, to the topic in their settings. */
  ntfyServer?: NtfyServer;
  /** Address of the web app, for the link back from each mirrored note. */
  mirrorWebUrl: string | null;
}
