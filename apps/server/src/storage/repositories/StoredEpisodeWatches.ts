import type { EpisodeWatches } from '@metrack/domain';

/** The episodes one user watched of one season. */
export interface StoredEpisodeWatches {
  userId: number;
  seasonId: number;
  watched: EpisodeWatches;
}
