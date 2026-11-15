/** The subset of `GET /tv/{id}/episode_groups` that is used. */
export interface TmdbEpisodeGroupList {
  results?: {
    id: string;
    name: string;
    type: number;
    episode_count?: number;
    group_count?: number;
  }[];
}
