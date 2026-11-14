/** A followed movie or series, as far as the release watcher needs it. */
export interface FollowedTitle {
  id: number;
  /** Titles without a TMDB id cannot be looked up and are skipped. */
  tmdbId: number | null;
  title: string;
}
