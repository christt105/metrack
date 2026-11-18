/** One episode of a season as the shared catalog stores it, numbered the way metrack numbers the season. */
export interface Episode {
  number: number;
  title: string | null;
  /** ISO `YYYY-MM-DD`. */
  airDate: string | null;
  /** Minutes. */
  runtime: number | null;
  tmdbId: number | null;
  overview: string | null;
  /** TMDB image path, loaded from the TMDB image host; null when there is none. */
  stillPath: string | null;
}
