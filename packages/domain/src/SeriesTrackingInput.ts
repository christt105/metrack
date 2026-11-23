import type { EpisodeWatches } from './EpisodeWatches.js';
import type { SeriesSeasonInput } from './SeriesSeasonInput.js';

export interface SeriesTrackingInput {
  seasons: readonly SeriesSeasonInput[];
  watches: EpisodeWatches;
  /** Keys of the episodes the user skipped. */
  skipped?: readonly string[];
  /** Intentions to watch a season again that replace the stored ones, by season id. */
  intents?: ReadonlyMap<number, boolean>;
  /** The watches before the change being written: a season none of whose episodes was watched in them remembers its status and dates. */
  before?: EpisodeWatches;
  today: string;
  /** Leave completed seasons that record none of their episodes as they are, instead of counting them as 0. */
  keepUnrecorded?: boolean;
}
