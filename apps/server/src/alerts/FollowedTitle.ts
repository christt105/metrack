/** A followed movie or series, as far as the release watcher needs it. */
export interface FollowedTitle {
  id: number;
  /** Titles without a TMDB id cannot be looked up and are skipped. */
  tmdbId: number | null;
  title: string;
  /** The TMDB episode group a series numbers its seasons by, when it has one. */
  tmdbEpisodeGroup?: string | null;
}
