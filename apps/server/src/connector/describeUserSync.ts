import { describeSyncResult } from '../sync/describeSyncResult.js';
import { describeRefreshes } from './describeRefreshes.js';
import type { UserSyncOutcome } from './UserSyncOutcome.js';

/** One line for the logs: what a sync of one user did. */
export function describeUserSync(outcome: UserSyncOutcome): string {
  const written = outcome.result
    ? describeSyncResult(outcome.result)
    : 'sync found nothing to write';
  const refreshes = describeRefreshes(outcome);
  return refreshes ? `${written}, ${refreshes}` : written;
}
