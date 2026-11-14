import type { D1ExportConfig } from '../cloudbackup/D1ExportConfig.js';
import type { R2Config } from '../cloudbackup/R2Config.js';

export interface CloudImageCleanupConfig {
  d1: D1ExportConfig;
  /** The bucket of the images; its credential must be allowed to delete objects. */
  r2: R2Config;
  /** A run that finds a larger share of all the images orphaned deletes nothing and fails. */
  maxFraction: number;
  /** A run that finds more orphans than this deletes nothing and fails. */
  maxCount: number;
}
