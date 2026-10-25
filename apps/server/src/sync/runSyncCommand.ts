import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { openDatabase } from '../storage/openDatabase.js';
import {
  MovieRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
} from '../storage/repositories/index.js';
import { createSyncService } from './createSyncService.js';
import { formatSyncReport } from './formatSyncReport.js';
import type { SyncConfig } from './SyncConfig.js';

export interface SyncCommandOptions {
  dataDir: string;
  apply: boolean;
  verbose: boolean;
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
  const targets = {
    movies: new MovieRepository(db),
    series: new SeriesRepository(db),
    seasons: new SeasonRepository(db),
    overrides: new SeasonOverrideRepository(db),
    unlinked: new UnlinkedTitleRepository(db),
  };
  const { service, pool } = createSyncService(config, db, targets);
  try {
    if (!options.apply) return formatSyncReport(await service.report(), options.verbose);
    const { plan, result } = await service.apply();
    return `${formatSyncReport(plan, options.verbose).replace('(nothing was written)', '(applied)')}\n\nApplied: ${JSON.stringify(result)}`;
  } finally {
    await pool.end();
    db.close();
  }
}
