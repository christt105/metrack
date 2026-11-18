import type { EpisodeWatches } from './EpisodeWatches.js';
import type { SeriesSeasonInput } from './SeriesSeasonInput.js';

export interface SeriesTrackingInput {
  seasons: readonly SeriesSeasonInput[];
  watches: EpisodeWatches;
  /** Keys of the episodes the user skipped. */
  skipped?: readonly string[];
  /** The watches before the change; only viewings missing from it can open a season rewatch. */
  baseline?: EpisodeWatches;
  today: string;
  /** Only the dates follow the watches, not the status or the rewatches: for removing episodes. */
  datesOnly?: boolean;
  /** Leave completed seasons that record none of their episodes as they are, instead of counting them as 0. */
  keepUnrecorded?: boolean;
}
