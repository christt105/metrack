import { writeFileSync } from 'node:fs';
import type { Logger } from '../notify/Logger.js';
import { CloudBackupJob } from './CloudBackupJob.js';
import type { CloudBackupConfig } from './CloudBackupConfig.js';
import { countRows } from './countRows.js';
import { createCloudBackup } from './createCloudBackup.js';
import { dumpToSql } from './dumpToSql.js';
import { formatCloudBackupResult } from './formatCloudBackupResult.js';
import { formatRowCounts } from './formatRowCounts.js';

export type CloudBackupCommand = 'cloud-backup' | 'restore-sql' | 'row-counts';

export interface CloudBackupCommandOptions {
  /** The database file for `restore-sql` and `row-counts`. */
  file?: string;
  /** Where `restore-sql` writes; `<file>.sql` by default. */
  out?: string;
}

/**
 * The one-shot commands around the cloud backup. `cloud-backup` runs a copy now and needs the settings; `restore-sql`
 * writes the SQL file that imports a copied database into an empty D1, and `row-counts` prints the rows per table to
 * compare with D1. Returns the text to print.
 */
export async function runCloudBackupCommand(
  command: CloudBackupCommand,
  config: CloudBackupConfig | undefined,
  options: CloudBackupCommandOptions,
  logger: Logger,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  if (command === 'cloud-backup') {
    if (!config) throw new Error('The cloud backup is not configured');
    const quiet = { info: () => undefined, error: logger.error };
    const job = new CloudBackupJob(createCloudBackup(config, fetchFn), noNotifier, quiet);
    return formatCloudBackupResult(await job.run());
  }
  if (!options.file) throw new Error(`${command} needs the database file`);
  if (command === 'row-counts') return formatRowCounts(countRows(options.file));
  const out = options.out ?? `${options.file}.sql`;
  const sql = dumpToSql(options.file);
  writeFileSync(out, sql);
  return `Wrote ${out} (${Buffer.byteLength(sql)} bytes). Import it into an empty D1 with: wrangler d1 execute <database> --remote --file ${out}`;
}

const noNotifier = { notify: async () => false };
