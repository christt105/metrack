import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createImageStore } from '../images/createImageStore.js';
import { MetadataCache } from '../metadata/MetadataCache.js';
import { registerTmdbMetadata } from '../metadata/registerTmdbMetadata.js';
import { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { TmdbClientOptions } from '../providers/tmdb/TmdbClientOptions.js';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { createSqliteRepositories } from '../storage/sqlite/createSqliteRepositories.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import { createSyncService } from './createSyncService.js';
import { formatSyncReport } from './formatSyncReport.js';
import type { SyncConfig } from './SyncConfig.js';
import { FixedUserScope } from '../users/FixedUserScope.js';
import { OWNER_ID } from '../users/OWNER_ID.js';

export interface SyncCommandOptions {
  dataDir: string;
  apply: boolean;
  verbose: boolean;
  /** When set, TheTVDB-only series are paired through TMDB and created titles get their metadata. */
  tmdb?: TmdbClientOptions;
}

/**
 * Compares Jellyfin playback with the tracking in the data directory and returns the text to print.
 * Without `apply` the database is opened read-only and nothing is written.
 */
export async function runSyncCommand(
  config: SyncConfig,
  options: SyncCommandOptions,
): Promise<string> {
  const dbPath = join(options.dataDir, 'metrack.db');
  if (!options.apply && !existsSync(dbPath)) throw new Error(`No database at ${dbPath}`);
  const db = options.apply ? openDatabase(dbPath) : new DatabaseSync(dbPath, { readOnly: true });
  if (options.apply) new MigrationRunner(db, migrations).run();
  const repositories = createSqliteRepositories(db, new FixedUserScope(OWNER_ID));
  const targets = repositories;
  let tmdb;
  if (options.tmdb) {
    const client = new TmdbClient(fetch, options.tmdb);
    const metadata = new MetadataCache(
      repositories.metadataStates,
      createImageStore(db, join(options.dataDir, 'images')),
    );
    registerTmdbMetadata(metadata, client, targets);
    tmdb = { client, metadata };
  }
  const { service, pool } = createSyncService(
    config,
    repositories.transactions,
    targets,
    console,
    tmdb,
  );
  try {
    if (!options.apply) return formatSyncReport(await service.report(), options.verbose);
    const { plan, result } = await service.apply();
    return `${formatSyncReport(plan, options.verbose).replace('(nothing was written)', '(applied)')}\n\nApplied: ${JSON.stringify(result)}`;
  } finally {
    await pool.end();
    db.close();
  }
}
