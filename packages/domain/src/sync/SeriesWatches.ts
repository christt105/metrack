import type { EpisodeWatches } from '../EpisodeWatches.js';

/** What the user watched of one series, as the sync reads it. */
export interface SeriesWatches {
  seriesId: number;
  watched: EpisodeWatches;
}
