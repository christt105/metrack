import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from '../config/Config.js';
import { createNotifier } from '../notify/createNotifier.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import { BackupCopier } from './BackupCopier.js';
import type { BackupCommand } from './BackupCommand.js';
import { createBackupJob } from './createBackupJob.js';
import { createBackupService } from './createBackupService.js';

/**
 * Runs the backup CLI commands against the data directory: `backups`, `backup`, `restore <name>`,
 * and for the copy in BACKUP_COPY_DIR, `copies` and `retrieve <name>`.
 */
export async function runBackupCommand(
  config: Config,
  command: BackupCommand,
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
      const job = createBackupJob(config, service, createNotifier(config.ntfy, console), console);
      return (await job.run()).name;
    }
    if (command === 'copies' || command === 'retrieve') {
      if (!config.backup.copy) throw new Error('BACKUP_COPY_DIR is not set');
      const copier = new BackupCopier(service, config.backup.dir, config.backup.copy);
      if (command === 'copies') return copier.list().join('\n');
      if (!name) throw new Error('retrieve needs a backup name');
      return `copied ${name} back to ${copier.retrieve(name)}; restore it with: restore ${name}`;
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
