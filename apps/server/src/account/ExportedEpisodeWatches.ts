import type { EpisodeWatches } from '@metrack/domain';

/** The episodes a user watched of one series, keyed by TMDB episode id or `s<season>e<episode>`. */
export interface ExportedEpisodeWatches {
  seriesId: number;
  watched: EpisodeWatches;
}
