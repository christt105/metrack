import type { Viewing } from './Viewing.js';

function compareDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

/**
 * Puts viewings in canonical form: closed viewings (with a finish) sorted by finish and then start, exact
 * duplicates removed, a start that falls after its finish dropped, and at most one open viewing (the one
 * that started last), always last.
 */
export function normalizeViewings(viewings: readonly Viewing[]): Viewing[] {
  const closed = new Map<string, Viewing>();
  let open: Viewing | null = null;
  for (const viewing of viewings) {
    const { startedAt, finishedAt } = viewing;
    if (finishedAt === null) {
      if (open === null || compareDates(open.startedAt, startedAt) <= 0) {
        open = { startedAt, finishedAt: null };
      }
      continue;
    }
    const start = startedAt !== null && startedAt > finishedAt ? null : startedAt;
    closed.set(`${start ?? ''}|${finishedAt}`, { startedAt: start, finishedAt });
  }
  const sorted = [...closed.values()].sort(
    (a, b) => compareDates(a.finishedAt, b.finishedAt) || compareDates(a.startedAt, b.startedAt),
  );
  return open === null ? sorted : [...sorted, open];
}
