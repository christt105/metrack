import type { EpisodeWatches } from '@metrack/domain';

/** The episodes a user watched of one season, with the identifiers that locate the season in the export. */
export interface ExportedEpisodeWatches {
  seasonId: number;
  seriesId: number;
  seasonNumber: number;
  watched: EpisodeWatches;
}
