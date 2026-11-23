/** What the season progress bar shows: the same numbers the season page gives it. */
export interface NextEpisodeProgress {
  /** Episodes watched or skipped, or done in the open rewatch; null when there is no progress to show. */
  watched: number | null;
  total: number | null;
  skipped: number;
  rewatch: boolean;
}
