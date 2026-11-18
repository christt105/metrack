import type { TmdbSeasonEpisode } from './TmdbSeasonEpisode.js';

/** The subset of `GET /tv/{id}/season/{n}` that is used. */
export interface TmdbSeasonResponse {
  episodes?: TmdbSeasonEpisode[];
}
