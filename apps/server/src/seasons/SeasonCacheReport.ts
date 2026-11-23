import type { SeasonCacheDrift } from './SeasonCacheDrift.js';
import type { SeasonDateConflict } from './SeasonDateConflict.js';

export interface SeasonCacheReport {
  /** Whether the entries that differ were rewritten. */
  repaired: boolean;
  seriesChecked: number;
  drifts: SeasonCacheDrift[];
  /** Entries with the start after the finish, whatever their catalog, as they are after any repair; never rewritten. */
  conflicts: SeasonDateConflict[];
}
