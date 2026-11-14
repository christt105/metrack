import type { CloudBackupResult } from './CloudBackupResult.js';

/** A one-line summary of a run, for the log and the command line. */
export function formatCloudBackupResult(result: CloudBackupResult): string {
  const kib = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KiB`;
  return [
    `cloud backup ${result.name}: ${result.rows} rows, SQL ${kib(result.sqlBytes)}, database ${kib(result.databaseBytes)}`,
    `${result.images} of ${result.bucketObjects} image(s) downloaded (${kib(result.imageBytes)})`,
    `${result.missingImages} listed image(s) missing`,
    `${result.pruned.length} old database(s) and ${result.prunedImages} unused image(s) pruned`,
    `${(result.durationMs / 1000).toFixed(1)} s`,
  ].join(', ');
}
