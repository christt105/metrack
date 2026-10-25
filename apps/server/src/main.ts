import { join } from 'node:path';
import { buildApp } from './api/buildApp.js';
import { loadConfig } from './config/loadConfig.js';
import { MigrationRunner } from './storage/MigrationRunner.js';
import { migrations } from './storage/migrations/index.js';
import { openDatabase } from './storage/openDatabase.js';

const config = loadConfig(process.env);
const db = openDatabase(join(config.dataDir, 'metrack.db'));
const migrationRunner = new MigrationRunner(db, migrations);
const schemaVersion = migrationRunner.run();

const app = await buildApp({
  appVersion: config.appVersion,
  migrationRunner,
  webDir: config.webDir,
});

const shutdown = async (): Promise<void> => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: config.host });
console.log(`metrack listening on ${config.host}:${config.port} (schema v${schemaVersion})`);
