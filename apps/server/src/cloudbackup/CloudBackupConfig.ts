import type { CloudBackupTime } from './CloudBackupTime.js';
import type { D1ExportConfig } from './D1ExportConfig.js';
import type { R2Config } from './R2Config.js';

export interface CloudBackupConfig {
  /** Folder that receives `databases/` and the shared `images/`. */
  dir: string;
  /** Number of copied databases to keep. */
  retention: number;
  /** Local time of the daily run. */
  time: CloudBackupTime;
  d1: D1ExportConfig;
  /** Undefined when only the database is copied. */
  r2?: R2Config;
}
