import type { CloudImageCleanupResult } from './CloudImageCleanupResult.js';

/** A one-line summary of a run, for the log and the command line. */
export function formatCloudImageCleanupResult(result: CloudImageCleanupResult): string {
  const mib = `${(result.orphanBytes / (1024 * 1024)).toFixed(1)} MiB`;
  const found = `${result.orphans} of ${result.total} image(s) orphaned (${mib})`;
  const outcome = result.applied
    ? `${result.removed} removed, ${result.failed} failed`
    : 'dry run, nothing deleted';
  return `cloud image cleanup: ${found}, ${outcome}, ${(result.durationMs / 1000).toFixed(1)} s`;
}
