/** An episode as reported by the media server. `airDate` is `YYYY-MM-DD`; `available` is false for episodes that are listed but not on disk. */
export interface LibraryEpisode {
  jellyfinId: string;
  number: number | null;
  airDate: string | null;
  runtimeSeconds: number | null;
  available: boolean;
}
