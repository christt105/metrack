import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ImageStore } from '../images/ImageStore.js';
import { MetadataCache } from '../metadata/MetadataCache.js';
import { MetadataStateRepository } from '../metadata/MetadataStateRepository.js';
import { registerTmdbMetadata } from '../metadata/registerTmdbMetadata.js';
import { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { TmdbClientOptions } from '../providers/tmdb/TmdbClientOptions.js';
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
  const targets = {
    movies: new MovieRepository(db),
    series: new SeriesRepository(db),
    seasons: new SeasonRepository(db),
    overrides: new SeasonOverrideRepository(db),
    unlinked: new UnlinkedTitleRepository(db),
  };
  let tmdb;
  if (options.tmdb) {
    const client = new TmdbClient(fetch, options.tmdb);
    const metadata = new MetadataCache(
      new MetadataStateRepository(db),
      new ImageStore(db, join(options.dataDir, 'images')),
    );
    registerTmdbMetadata(metadata, client, targets);
    tmdb = { client, metadata };
  }
  const { service, pool } = createSyncService(config, db, targets, console, tmdb);
  try {
    if (!options.apply) return formatSyncReport(await service.report(), options.verbose);
    const { plan, result } = await service.apply();
    return `${formatSyncReport(plan, options.verbose).replace('(nothing was written)', '(applied)')}\n\nApplied: ${JSON.stringify(result)}`;
  } finally {
    await pool.end();
    db.close();
  }
}
