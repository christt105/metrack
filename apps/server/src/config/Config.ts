import type { BackupConfig } from '../backup/BackupConfig.js';
import type { ImageLimits } from '../images/ImageLimits.js';
import type { AlertsConfig } from './AlertsConfig.js';
import type { GoogleLoginConfig } from './GoogleLoginConfig.js';
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
  /** Steam Web API key (STEAM_API_KEY); without it Steam imports are off. */
  steamApiKey: string | undefined;
  igdb?: IgdbClientOptions;
  /** Offers "Sign in with Google" to users that already exist (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET). */
  google?: GoogleLoginConfig;
  backup: BackupConfig;
  images: ImageLimits;
  alerts: AlertsConfig;
  /** Instance alerts, such as failed backups. */
  ntfy?: NtfyConfig;
  /** Where each user's alerts go, to the topic in their settings. */
  ntfyServer?: NtfyServer;
  /** Address the public pages and their feed are reached at; the visitor's own address when unset. */
  publicUrl: string | null;
  /** Where the privacy page says to write about one's data. */
  contactEmail: string;
  /** Address of the web app, for the link back from each mirrored note. */
  mirrorWebUrl: string | null;
}
