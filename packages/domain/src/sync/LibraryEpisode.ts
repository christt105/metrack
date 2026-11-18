/** An episode as reported by the media server. `airDate` is `YYYY-MM-DD`; `available` is false for episodes that are listed but not on disk. */
export interface LibraryEpisode {
  jellyfinId: string;
  number: number | null;
  /** The episode's name, for messages. */
  name?: string | null;
  airDate: string | null;
  runtimeSeconds: number | null;
  available: boolean;
  /** Whether the tracked account has the episode marked as played. */
  played?: boolean;
  /** TheTVDB id of the episode, when the media server has one. */
  tvdbId?: number | null;
  /** TMDB id of the episode, when the media server has one. */
  tmdbId?: number | null;
}
