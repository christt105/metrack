import type { EpisodeWatches, SeasonTracking } from '@metrack/domain';

/** A user's completed entry for a season, with what that user watched and skipped of the series. */
export interface CompletedSeasonEntry {
  userId: number;
  tracking: SeasonTracking;
  watched: EpisodeWatches;
  skipped: string[];
}
