import type { HistoryRow } from './HistoryRow';

/**
 * A pass of the history: `number` is 1 for the first time and counts up for each rewatch, or null for a pass left
 * behind on `abandonedOn`.
 */
export interface HistoryPass {
  number: number | null;
  abandonedOn: string | null;
  rows: HistoryRow[];
  startedAt: string | null;
  finishedAt: string | null;
}
