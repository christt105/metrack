import type { EpisodeWatches, UnmatchedEpisode } from '@metrack/domain';

/** The episodes one user watched of one series. */
export interface StoredEpisodeWatches {
  userId: number;
  seriesId: number;
  watched: EpisodeWatches;
  /** Keys of the episodes the user skipped. */
  skipped: string[];
  /** The watched library episodes the last sync could not record. */
  unmatched: UnmatchedEpisode[];
}
