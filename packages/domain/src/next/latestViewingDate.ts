import type { EpisodeWatches } from '../EpisodeWatches.js';

/** The most recent date among the viewings of the watches, or null when none has one. */
export function latestViewingDate(watches: EpisodeWatches): string | null {
  let latest: string | null = null;
  for (const viewings of Object.values(watches)) {
    for (const viewing of viewings) {
      for (const date of [viewing.finishedAt, viewing.startedAt]) {
        if (date !== null && (latest === null || date > latest)) latest = date;
      }
    }
  }
  return latest;
}
