import type { SeasonTracking } from './SeasonTracking.js';

export interface DerivedSeasonTracking extends SeasonTracking {
  /** Whether the derivation moved a season that was not completed to completed. */
  completes: boolean;
}
