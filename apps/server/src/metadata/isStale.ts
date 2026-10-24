import type { ExpiryPolicy } from './ExpiryPolicy.js';
import type { Lifecycle } from './Lifecycle.js';

const DAY_MS = 86_400_000;

/**
 * Whether metadata fetched at `fetchedAt` should be refreshed at `now`.
 * Recent and upcoming releases expire first, finished titles last. Never fetched means stale.
 */
export function isStale(
  fetchedAt: string | null,
  lifecycle: Lifecycle,
  policy: ExpiryPolicy,
  now: Date,
): boolean {
  if (!fetchedAt) return true;
  const age = now.getTime() - new Date(fetchedAt).getTime();
  return age >= ttlDays(lifecycle, policy, now) * DAY_MS;
}

function ttlDays(lifecycle: Lifecycle, policy: ExpiryPolicy, now: Date): number {
  if (isRecent(lifecycle.releaseDate, policy.recentWindowDays, now)) return policy.recentTtlDays;
  return lifecycle.finished ? policy.finishedTtlDays : policy.defaultTtlDays;
}

function isRecent(releaseDate: string | null, windowDays: number, now: Date): boolean {
  if (!releaseDate) return false;
  const release = new Date(releaseDate).getTime();
  if (Number.isNaN(release)) return false;
  return Math.abs(now.getTime() - release) <= windowDays * DAY_MS || release > now.getTime();
}
