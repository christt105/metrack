/** A TMDB episode found by its TheTVDB id, with the TMDB series it belongs to when TMDB says so. */
export interface TmdbEpisodeMatch {
  id: number;
  showId: number | null;
}
