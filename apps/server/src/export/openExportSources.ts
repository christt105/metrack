import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { createImageStore } from '../images/createImageStore.js';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { createSqliteRepositories } from '../storage/sqlite/createSqliteRepositories.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import type { ExportSources } from './loadExportInput.js';
import { FixedUserScope } from '../users/FixedUserScope.js';
import { OWNER_ID } from '../users/OWNER_ID.js';

/** Opens the database and image store in a data directory with the repositories the exporter reads, as one user. */
export function openExportSources(
  dataDir: string,
  userId: number = OWNER_ID,
): { db: DatabaseSync; sources: ExportSources } {
  const db = openDatabase(join(dataDir, 'metrack.db'));
  new MigrationRunner(db, migrations).run();
  return {
    db,
    sources: {
      ...createSqliteRepositories(db, new FixedUserScope(userId)),
      images: createImageStore(db, join(dataDir, 'images')),
    },
  };
}
