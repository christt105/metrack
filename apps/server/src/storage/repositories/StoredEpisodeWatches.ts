import type { EpisodeWatches } from '@metrack/domain';

/** The episodes one user watched of one series. */
export interface StoredEpisodeWatches {
  userId: number;
  seriesId: number;
  watched: EpisodeWatches;
}
