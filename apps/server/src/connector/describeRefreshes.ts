import type { UserSyncOutcome } from './UserSyncOutcome.js';

/** What asking for metadata did, or undefined when there was nothing to ask for. */
export function describeRefreshes(outcome: UserSyncOutcome): string | undefined {
  const total = outcome.created + outcome.unfetched;
  return total === 0
    ? undefined
    : `refreshed ${outcome.refreshed} of ${total} titles without metadata`;
}
