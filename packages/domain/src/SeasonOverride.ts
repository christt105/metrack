/** Manual correction for a provider season, keyed by the TMDB season number of a series. */
export interface SeasonOverride {
  seriesId: number;
  tmdbSeasonNumber: number;
  number: number | null;
  title: string | null;
  jellyfinSeasonId: string | null;
}
