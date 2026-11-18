import { collectWatchDays } from './collectWatchDays.js';
import { makeDateOf } from './makeDateOf.js';
import type { SyncInput } from './SyncInput.js';

/** The days each library item was watched on, from the playback in the input (see `collectWatchDays`). */
export function collectSyncWatchDays(
  input: Pick<SyncInput, 'movies' | 'series' | 'plays' | 'timeZone'>,
): ReturnType<typeof collectWatchDays> {
  const runtimes = new Map<string, number | null>();
  const played = new Set<string>();
  for (const movie of input.movies) {
    runtimes.set(movie.jellyfinId, movie.runtimeSeconds);
    if (movie.played) played.add(movie.jellyfinId);
  }
  for (const series of input.series) {
    for (const season of series.seasons) {
      for (const episode of season.episodes) {
        runtimes.set(episode.jellyfinId, episode.runtimeSeconds);
        if (episode.played) played.add(episode.jellyfinId);
      }
    }
  }
  return collectWatchDays(input.plays, runtimes, makeDateOf(input.timeZone), played);
}
