/** The part of TMDB's `/find/{external_id}` answer metrack reads. */
export interface TmdbFindResponse {
  tv_results: { id: number }[];
  tv_episode_results?: { id: number; show_id?: number }[];
}
