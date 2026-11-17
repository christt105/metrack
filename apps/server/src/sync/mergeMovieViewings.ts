import { finishDates, normalizeViewings, type Viewing } from '@metrack/domain';

/**
 * Adds a closed viewing for each finish date the stored viewings do not have yet, keeping the stored ones with
 * their starts. An open viewing is closed by the earliest new date, or dropped when there is none, because the
 * movie is completed.
 */
export function mergeMovieViewings(
  stored: readonly Viewing[],
  dates: readonly string[],
): Viewing[] {
  const known = new Set(finishDates(stored));
  const added = [...new Set(dates)].filter((date) => !known.has(date)).sort();
  const closed = stored.filter((v) => v.finishedAt !== null);
  const open = stored.find((v) => v.finishedAt === null);
  const closing = open && added.length > 0 ? added.shift() : undefined;
  return normalizeViewings([
    ...closed,
    ...(open && closing ? [{ startedAt: open.startedAt, finishedAt: closing }] : []),
    ...added.map((finishedAt) => ({ startedAt: null, finishedAt })),
  ]);
}
