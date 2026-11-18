import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import type { SeasonTracking } from './SeasonTracking.js';

export interface SeasonTrackingInput {
  tracking: SeasonTracking;
  /** The episodes the season is expected to have; empty when unknown. */
  episodes: readonly ExpectedEpisode[];
  /** What the user watched of the whole series; only the keys of `episodes` count for this season. */
  watches: EpisodeWatches;
  /**
   * The watches that were already stored before this change. Only viewings that are not in it can open a season
   * rewatch; without it every viewing counts as new.
   */
  baseline?: EpisodeWatches;
  /** Today as `YYYY-MM-DD`; episodes airing later are not expected to be watched yet. */
  today: string;
}
