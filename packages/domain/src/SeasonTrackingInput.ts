import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import type { SeasonTracking } from './SeasonTracking.js';

export interface SeasonTrackingInput {
  /** What the season entry holds now: the manual fallback when the episodes say nothing, and the intention. */
  tracking: SeasonTracking;
  /** The episodes the season is expected to have. */
  episodes: readonly ExpectedEpisode[];
  /** What the user watched of the whole series; only the keys of `episodes` count for this season. */
  watches: EpisodeWatches;
  /** Keys of the episodes the user skipped: not owed for a pass to complete. */
  skipped?: ReadonlySet<string>;
  /** Today as `YYYY-MM-DD`; episodes airing later are not expected to be watched yet. */
  /** Whether none of the season's episodes had a viewing before the change being written. */
  previouslyEmpty?: boolean;
  today: string;
}
