/** An episode in a series' TMDB ordering (an episode group, or the regular seasons), numbered the way metrack numbers the seasons. */
export interface OrderedEpisode {
  tmdbId: number;
  /** The season's number in the ordering. */
  seasonNumber: number;
  /** The episode's place in that season, from 1. */
  number: number;
  /** ISO `YYYY-MM-DD`. */
  airDate: string | null;
}
