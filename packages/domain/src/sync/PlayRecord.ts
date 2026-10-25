/** One playback session of a movie or an episode. `playedAt` is an ISO timestamp, `watchedSeconds` the time actually played. */
export interface PlayRecord {
  itemId: string;
  playedAt: string;
  watchedSeconds: number;
}
