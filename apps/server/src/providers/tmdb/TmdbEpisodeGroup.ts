/** One episode inside a season of an episode group. */
export interface TmdbGroupEpisode {
  id?: number;
  name?: string;
  overview?: string;
  runtime?: number | null;
  season_number: number;
  episode_number: number;
  air_date?: string | null;
  order?: number;
}

/** One season of an episode group. `order` is its season number in that ordering. */
export interface TmdbGroupSeason {
  id: string;
  name: string;
  order: number;
  episodes?: TmdbGroupEpisode[];
}

/** The subset of `GET /tv/episode_group/{id}` that is used. */
export interface TmdbEpisodeGroup {
  id: string;
  name: string;
  type: number;
  episode_count?: number;
  group_count?: number;
  groups?: TmdbGroupSeason[];
}
