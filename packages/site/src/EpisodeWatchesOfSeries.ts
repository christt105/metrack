import type { EpisodeWatches } from '@metrack/domain';

/** The episodes the user watched and skipped of one series. */
export interface EpisodeWatchesOfSeries {
  seriesId: number;
  watched: EpisodeWatches;
  skipped: string[];
}
