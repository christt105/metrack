/** One TMDB episode group of a series: an alternative way of splitting its episodes into seasons. */
export interface EpisodeGroupSummary {
  id: string;
  name: string;
  /** TMDB's group type; see `SEASONS_EPISODE_GROUP_TYPE`. */
  type: number;
  groupCount: number;
  episodeCount: number;
}
