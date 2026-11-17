import { normalizeViewings } from './normalizeViewings.js';
import type { Viewing } from './Viewing.js';

/** Closed viewings without a start, one per date. */
export function viewingsFromDates(dates: readonly string[]): Viewing[] {
  return normalizeViewings(dates.map((finishedAt) => ({ startedAt: null, finishedAt })));
}
