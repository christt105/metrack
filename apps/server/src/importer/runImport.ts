import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ImageStore } from '../images/ImageStore.js';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { openDatabase } from '../storage/openDatabase.js';
import {
  BookRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
  VideogameRepository,
} from '../storage/repositories/index.js';
import { buildImportPlan } from './buildImportPlan.js';
import { formatApplyResult } from './formatApplyResult.js';
import { formatReport } from './formatReport.js';
import { ImportApplier } from './ImportApplier.js';
import { IssueLog } from './IssueLog.js';
import { readVaultNotes } from './readVaultNotes.js';

export interface ImportOptions {
  vaultDir: string;
  dataDir: string;
  apply: boolean;
  verbose: boolean;
}

/**
 * Reads the Media Tracker notes and returns the text to print. Without `apply` nothing is
 * written, not even the database.
 */
export async function runImport(options: ImportOptions): Promise<string> {
  const vaultDir = resolve(options.vaultDir);
  if (!existsSync(vaultDir) || !statSync(vaultDir).isDirectory()) {
    throw new Error(`Not a directory: ${vaultDir}`);
  }
  const issues = new IssueLog();
  const plan = buildImportPlan(readVaultNotes(vaultDir, issues), vaultDir, issues);
  const report = formatReport(plan, options.verbose);
  if (!options.apply) return report;

  const db = openDatabase(join(options.dataDir, 'metrack.db'));
  try {
    new MigrationRunner(db, migrations).run();
    const targets = {
      movies: new MovieRepository(db),
      series: new SeriesRepository(db),
      seasons: new SeasonRepository(db),
      videogames: new VideogameRepository(db),
      books: new BookRepository(db),
      unlinked: new UnlinkedTitleRepository(db),
    };
    const store = new ImageStore(db, join(options.dataDir, 'images'));
    const result = await new ImportApplier(db, targets, store).apply(plan);
    return `${report}\n\n${formatApplyResult(result)}`;
  } finally {
    db.close();
  }
}
