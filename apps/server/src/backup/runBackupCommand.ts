import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from '../config/Config.js';
import { createNotifier } from '../notify/createNotifier.js';
import { openDatabase } from '../storage/openDatabase.js';
import { BackupJob } from './BackupJob.js';
import { createBackupService } from './createBackupService.js';

/** Runs the backup CLI commands `backups`, `backup` and `restore <name>` against the data directory. */
export async function runBackupCommand(
  config: Config,
  command: 'backups' | 'backup' | 'restore',
  name: string | undefined,
): Promise<string> {
  const dbPath = join(config.dataDir, 'metrack.db');
  if (command === 'backup' && !existsSync(dbPath)) {
    throw new Error(`No database at ${dbPath}; check DATA_DIR`);
  }
  const db = openDatabase(dbPath);
  const service = createBackupService(config, db);
  let closed = false;
  try {
    if (command === 'backups') {
      return service
        .list()
        .map((info) => `${info.name}  ${info.sizeBytes} bytes  images=${info.hasImages}`)
        .join('\n');
    }
    if (command === 'backup') {
      const job = new BackupJob(
        service,
        config.backup.retention,
        createNotifier(config.ntfy, console),
        console,
      );
      return (await job.run()).name;
    }
    if (!name) {
      throw new Error('restore needs a backup name');
    }
    db.close();
    closed = true;
    const safetyDir = service.restore(name);
    return `restored ${name}; the replaced data was moved to ${safetyDir}; start the server again`;
  } finally {
    if (!closed) db.close();
  }
}
