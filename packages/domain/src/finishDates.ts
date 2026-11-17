import type { Viewing } from './Viewing.js';

/** The finish dates of the closed viewings, sorted and unique. */
export function finishDates(viewings: readonly Viewing[]): string[] {
  return [
    ...new Set(viewings.flatMap((v) => (v.finishedAt === null ? [] : [v.finishedAt]))),
  ].sort();
}
