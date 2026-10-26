/** The part of TMDB's `/find/{external_id}` answer metrack reads. */
export interface TmdbFindResponse {
  tv_results: { id: number }[];
}
