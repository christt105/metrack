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
}
