/** One episode of `GET /tv/{id}/season/{n}`; crew and guest stars are not read. */
export interface TmdbSeasonEpisode {
  id?: number;
  episode_number: number;
  name?: string;
  air_date?: string | null;
  runtime?: number | null;
  overview?: string;
}
