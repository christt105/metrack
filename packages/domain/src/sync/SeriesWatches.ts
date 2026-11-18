import type { EpisodeWatches } from '../EpisodeWatches.js';
import type { UnmatchedEpisode } from './UnmatchedEpisode.js';

/** What the user watched of one series, as the sync reads it. */
export interface SeriesWatches {
  seriesId: number;
  watched: EpisodeWatches;
  /** Keys of the episodes the user skipped; absent from connectors that predate skipping. */
  skipped?: readonly string[];
  /** The watched library episodes the last sync could not record; absent from servers that predate it. */
  unmatched?: readonly UnmatchedEpisode[];
}
