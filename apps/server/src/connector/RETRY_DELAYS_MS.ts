/** Waits before the 1st, 2nd, 3rd and later retries of something that keeps failing: 1, 5, 15 and 60 minutes. */
export const RETRY_DELAYS_MS: readonly number[] = [60_000, 300_000, 900_000, 3_600_000];
