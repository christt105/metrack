import type { SeasonTracking } from '@metrack/domain';

/** What a season entry holds as a cache of its episodes. */
export interface SeasonCacheState {
  tracking: SeasonTracking;
  watchedCount: number;
  skippedCount: number;
}
