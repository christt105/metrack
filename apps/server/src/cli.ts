import { join } from 'node:path';
import { BackupJob } from './backup/BackupJob.js';
import { createBackupService } from './backup/createBackupService.js';
import { loadConfig } from './config/loadConfig.js';
import { createNotifier } from './notify/createNotifier.js';
import { openDatabase } from './storage/openDatabase.js';

const usage = 'Usage: cli.js <list | create | restore <backup-name>>';

const config = loadConfig(process.env);
const db = openDatabase(join(config.dataDir, 'metrack.db'));
const service = createBackupService(config, db);
const [command, argument] = process.argv.slice(2);

try {
  if (command === 'list') {
    for (const info of service.list()) {
      console.log(`${info.name}  ${info.sizeBytes} bytes  images=${info.hasImages}`);
    }
  } else if (command === 'create') {
    const job = new BackupJob(
      service,
      config.backup.retention,
      createNotifier(config.ntfy, console),
      console,
    );
    console.log((await job.run()).name);
  } else if (command === 'restore' && argument) {
    db.close();
    service.restore(argument);
    console.log(`restored ${argument}; start the server again`);
  } else {
    console.error(usage);
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
