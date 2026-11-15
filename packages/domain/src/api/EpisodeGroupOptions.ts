import type { EpisodeGroupSummary } from './EpisodeGroupSummary.js';

/** The season orderings TMDB offers for a series, with the one in use and the one metrack would pick. */
export interface EpisodeGroupOptions {
  /** The group the series uses; null for the regular TMDB seasons. */
  current: string | null;
  groups: EpisodeGroupSummary[];
  /** The only "Seasons" group that has the seasons the series has locally and TMDB does not know, if there is one. */
  suggested: string | null;
}
