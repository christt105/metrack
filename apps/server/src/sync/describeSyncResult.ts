import type { SyncApplyResult } from '@metrack/domain';

/** One line for the logs: what a sync run wrote. */
export function describeSyncResult(result: SyncApplyResult): string {
  const parts = [
    ['movies created', result.moviesCreated],
    ['movies updated', result.moviesUpdated],
    ['series created', result.seriesCreated],
    ['series updated', result.seriesUpdated],
    ['seasons created', result.seasonsCreated],
    ['seasons updated', result.seasonsUpdated],
    ['unlinked added', result.unlinkedAdded],
  ].filter(([, count]) => (count as number) > 0);
  return parts.length === 0
    ? 'sync found nothing to write'
    : `sync wrote ${parts.map(([label, count]) => `${count} ${label}`).join(', ')}`;
}
