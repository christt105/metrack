/**
 * One playback session of a movie or an episode. `playedAt` is an ISO timestamp, `watchedSeconds` the time actually played,
 * `title` the movie or series name the history recorded, used to report playback of items that left the library.
 */
export interface PlayRecord {
  itemId: string;
  title?: string;
  playedAt: string;
  watchedSeconds: number;
}
