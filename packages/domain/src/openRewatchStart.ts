import type { Viewing } from './Viewing.js';

/** The start of the open season rewatch, or null when none is open. */
export function openRewatchStart(rewatches: readonly Viewing[]): string | null {
  return rewatches.find((viewing) => viewing.finishedAt === null)?.startedAt ?? null;
}
