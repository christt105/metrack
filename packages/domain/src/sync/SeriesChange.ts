import type { EpisodeWatches } from '../EpisodeWatches.js';
import type { SeasonChange } from './SeasonChange.js';

/** A series to create (`seriesId` null) or link, with the seasons whose viewings changed. */
export interface SeriesChange {
  seriesId: number | null;
  jellyfinId: string;
  tmdbId: number | null;
  tvdbId: number | null;
  title: string;
  year: number | null;
  seasons: SeasonChange[];
  /** The watched episodes of the series merged with the stored ones; present only when they change. */
  watches?: EpisodeWatches;
  /** The series' skipped episode keys once the played ones are taken out; present only when they change. */
  skipped?: string[];
}
