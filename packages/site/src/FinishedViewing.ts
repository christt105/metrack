import type { PublicEntry } from './PublicEntry.js';

/** One day an item was finished: its finish date or one of its rewatches. */
export interface FinishedViewing {
  entry: PublicEntry;
  date: string | null;
}
