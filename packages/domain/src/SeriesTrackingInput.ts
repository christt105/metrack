import type { EpisodeWatches } from './EpisodeWatches.js';
import type { SeriesSeasonInput } from './SeriesSeasonInput.js';

export interface SeriesTrackingInput {
  seasons: readonly SeriesSeasonInput[];
  watches: EpisodeWatches;
  /** Keys of the episodes the user skipped. */
  skipped?: readonly string[];
  /** Intentions to watch a season again that replace the stored ones, by season id. */
  intents?: ReadonlyMap<number, boolean>;
  today: string;
  /** Leave completed seasons that record none of their episodes as they are, instead of counting them as 0. */
  keepUnrecorded?: boolean;
}
