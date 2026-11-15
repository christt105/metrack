/** Sets the season ordering of a series: a TMDB episode group id, or null for the regular TMDB seasons. */
export interface SeasonOrderingRequest {
  episodeGroup: string | null;
}
