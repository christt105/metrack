import type { EpisodeWatches, SeriesSeasonInput } from '@metrack/domain';

/** The user's seasons of a series whose episodes are known, and what they watched of the series. */
export interface SeriesWatchState {
  seasons: SeriesSeasonInput[];
  /** Undefined when the user has no watches row for the series. */
  watches: EpisodeWatches | undefined;
}
