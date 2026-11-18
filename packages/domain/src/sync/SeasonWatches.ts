import type { EpisodeWatches } from '../EpisodeWatches.js';

/** What the user watched of one season, as the sync reads it. */
export interface SeasonWatches {
  seasonId: number;
  watched: EpisodeWatches;
}
