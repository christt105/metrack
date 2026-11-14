import type { ReleaseAlertsConfig } from './ReleaseAlertsConfig.js';
import type { CloudBackupConfig } from '../cloudbackup/CloudBackupConfig.js';
import type { SyncConfig } from '../sync/SyncConfig.js';

export interface ConnectorConfig {
  /** Address of the metrack the connector syncs into, for example the Worker. */
  cloudUrl: string;
  /** The `connector` token (or a personal `write` token) the cloud accepts on `/api/connector`. */
  token: string;
  /** The Jellyfin and Jellystat settings, the webhook secret and delay, the time zone. */
  sync: SyncConfig;
  /** Where the connector keeps its own state. */
  dataDir: string;
  /** Time between full passes over every user, whether a webhook arrived or not. */
  passIntervalMs: number;
  /** Release alerts from home. Undefined when `CONNECTOR_RELEASE_ALERTS` is not `true`. */
  releaseAlerts?: ReleaseAlertsConfig;
  /** The daily copy of the cloud data. Undefined when its variables are not set. */
  cloudBackup?: CloudBackupConfig;
}
