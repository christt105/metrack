import { describeSyncResult } from '../sync/describeSyncResult.js';
import type { UserSyncOutcome } from './UserSyncOutcome.js';

/** One line for the logs: what a sync of one user did. */
export function describeUserSync(outcome: UserSyncOutcome): string {
  if (!outcome.result) return 'sync found nothing to write';
  const refreshed =
    outcome.created === 0
      ? ''
      : `, refreshed ${outcome.refreshed} of ${outcome.created} created titles`;
  return `${describeSyncResult(outcome.result)}${refreshed}`;
}
