import type { CloudBackupConfig } from './CloudBackupConfig.js';

export interface CloudBackupConfigResult {
  /** Undefined when the feature is off or incompletely configured. */
  config: CloudBackupConfig | undefined;
  /** Names of the variables still needed when some, but not all, of the required ones are set. */
  missing: string[];
}
