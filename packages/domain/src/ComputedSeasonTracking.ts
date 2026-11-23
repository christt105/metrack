import type { SeasonTracking } from './SeasonTracking.js';

/** A catalog season's tracking and counters as `computeSeasonTracking` derives them. */
export interface ComputedSeasonTracking {
  tracking: SeasonTracking;
  /** Distinct episodes of the season with a viewing. */
  watchedCount: number;
  /** Episodes of the season that are skipped. */
  skippedCount: number;
  /** Whether the season was not completed and now is. */
  completes: boolean;
}
