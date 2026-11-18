import type { SeasonTracking } from './SeasonTracking.js';

/** What to write to a user's season entry after their watches of the series changed. */
export interface SeasonEntryUpdate {
  seasonId: number;
  watchedCount: number;
  tracking: SeasonTracking;
  /** Whether the update completes a season that was not completed before. */
  completes: boolean;
}
