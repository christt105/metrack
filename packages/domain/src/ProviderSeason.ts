/** A season as TMDB lists it, either a regular season or one season of an episode group. */
export interface ProviderSeason {
  number: number;
  title: string | null;
  overview: string | null;
  firstAirDate: string | null;
  episodeCount: number | null;
  posterUrl: string | null;
}
