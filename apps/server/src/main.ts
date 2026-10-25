import { join } from 'node:path';
import { buildApp } from './api/buildApp.js';
import { BackupJob } from './backup/BackupJob.js';
import { BackupScheduler } from './backup/BackupScheduler.js';
import { createBackupService } from './backup/createBackupService.js';
import { loadConfig } from './config/loadConfig.js';
import { createNotifier } from './notify/createNotifier.js';
import { MigrationRunner } from './storage/MigrationRunner.js';
import { migrations } from './storage/migrations/index.js';
import { openDatabase } from './storage/openDatabase.js';

const config = loadConfig(process.env);
const db = openDatabase(join(config.dataDir, 'metrack.db'));
const migrationRunner = new MigrationRunner(db, migrations);
const schemaVersion = migrationRunner.run();

const backupService = createBackupService(config, db);
const backupJob = new BackupJob(
  backupService,
  config.backup.retention,
  createNotifier(config.ntfy, console),
  console,
);
const scheduler = new BackupScheduler(
  backupService,
  backupJob,
  config.backup.intervalHours * 3_600_000,
  console,
);

const app = await buildApp({
  appVersion: config.appVersion,
  migrationRunner,
  webDir: config.webDir,
  backup: { service: backupService, job: backupJob },
});

const shutdown = async (): Promise<void> => {
  scheduler.stop();
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: config.host });
if (config.backup.enabled) {
  scheduler.start();
}
console.log(`metrack listening on ${config.host}:${config.port} (schema v${schemaVersion})`);
