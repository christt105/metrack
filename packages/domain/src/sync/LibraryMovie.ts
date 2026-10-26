/** A movie in the media server library. */
export interface LibraryMovie {
  jellyfinId: string;
  title: string;
  year: number | null;
  tmdbId: number | null;
  runtimeSeconds: number | null;
  /** Whether the tracked account has the movie marked as played. */
  played?: boolean;
}
