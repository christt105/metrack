import type { ExpectedEpisode } from './ExpectedEpisode.js';
import type { SeasonTracking } from './SeasonTracking.js';

/** One season of a series as `deriveSeriesTracking` reads it; only seasons whose episodes are known are passed. */
export interface SeriesSeasonInput {
  seasonId: number;
  tracking: SeasonTracking;
  /** The season entry's `watched_count` as stored. */
  watchedCount: number;
  episodes: readonly ExpectedEpisode[];
}
