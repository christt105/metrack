import { ACCOUNT_DELETION_GRACE_DAYS, type AccountDeletion } from '@metrack/domain';

const DAY_MS = 24 * 3_600_000;

/** The deletion a request made at `requestedAt` leads to. */
export function scheduleOf(requestedAt: string): AccountDeletion {
  return {
    requestedAt,
    deleteAt: new Date(
      Date.parse(requestedAt) + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS,
    ).toISOString(),
  };
}

/** The latest request time that is already past its grace period at `now`. */
export function lastDueRequest(now: Date): string {
  return new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * DAY_MS).toISOString();
}
