import type { Viewing } from './Viewing.js';

function compareDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

function normalizeLive(viewings: readonly Viewing[]): Viewing[] {
  const closed = new Map<string, Viewing>();
  let open: Viewing | null = null;
  let undated = false;
  for (const viewing of viewings) {
    const { startedAt, finishedAt } = viewing;
    if (finishedAt === null && startedAt === null) {
      undated = true;
      continue;
    }
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
  const first: Viewing[] = undated ? [{ startedAt: null, finishedAt: null }] : [];
  return open === null ? [...first, ...sorted] : [...first, ...sorted, open];
}

function normalizeAbandoned(viewings: readonly Viewing[]): Viewing[] {
  const unique = new Map<string, Viewing>();
  for (const { startedAt, finishedAt, abandonedAt } of viewings) {
    if (abandonedAt === undefined) continue;
    const start =
      finishedAt !== null && startedAt !== null && startedAt > finishedAt ? null : startedAt;
    unique.set(`${abandonedAt}|${start ?? ''}|${finishedAt ?? ''}`, {
      startedAt: start,
      finishedAt,
      abandonedAt,
    });
  }
  return [...unique.values()].sort(
    (a, b) =>
      (a.abandonedAt as string).localeCompare(b.abandonedAt as string) ||
      compareDates(a.finishedAt, b.finishedAt) ||
      compareDates(a.startedAt, b.startedAt),
  );
}

/**
 * Puts viewings in canonical form: first the abandoned ones (see `Viewing.abandonedAt`), oldest abandonment first
 * and exact duplicates removed, then the live ones: closed viewings (with a finish) sorted by finish and then
 * start, exact duplicates removed, a start that falls after its finish dropped, and at most one open viewing (the
 * one that started last), always last. A live viewing with neither date is a viewing on an unknown date: it is
 * kept once, first among the live ones.
 */
export function normalizeViewings(viewings: readonly Viewing[]): Viewing[] {
  return [
    ...normalizeAbandoned(viewings),
    ...normalizeLive(viewings.filter((viewing) => viewing.abandonedAt === undefined)),
  ];
}
