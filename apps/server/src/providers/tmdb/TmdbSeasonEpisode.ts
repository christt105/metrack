/** One episode of `GET /tv/{id}/season/{n}` or `GET /tv/{id}/season/{n}/episode/{e}`; crew and guest stars are not read. */
export interface TmdbSeasonEpisode {
  id?: number;
  episode_number: number;
  name?: string;
  air_date?: string | null;
  runtime?: number | null;
  overview?: string;
  still_path?: string | null;
}
