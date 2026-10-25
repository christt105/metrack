/** One entry of the `seasons` list in a TMDB TV details response. */
export interface TmdbSeasonSummary {
  season_number: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  episode_count?: number;
  poster_path?: string | null;
}
