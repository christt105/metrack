/** A season as reported by one provider (TMDB, Jellyfin, ...). */
export interface SeasonSource {
  number: number;
  title?: string;
  firstAirDate: string;
  episodeCount: number;
}
