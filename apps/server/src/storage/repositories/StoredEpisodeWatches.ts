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
  /** When the user last changed the watched or skipped episodes, or null for rows from before it was recorded. */
  lastActivityAt: string | null;
}
