import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { Config } from '../config/Config.js';
import { BackupService } from './BackupService.js';

/** Builds a backup service for the live database and image store under the data directory. */
export function createBackupService(config: Config, db: DatabaseSync): BackupService {
  return new BackupService(
    db,
    { dbPath: join(config.dataDir, 'metrack.db'), imagesDir: join(config.dataDir, 'images') },
    config.backup.dir,
  );
}
