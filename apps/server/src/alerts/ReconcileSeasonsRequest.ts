import type { SeriesRelease } from './SeriesRelease.js';

export interface ReconcileSeasonsRequest {
  seriesId: number;
  /** What TMDB announces for the series, fetched by the caller. */
  release: SeriesRelease;
  /** The local date, `YYYY-MM-DD`, that decides which announced seasons are recent enough to create. */
  today: string;
}
