import type { EpisodeWatches } from './EpisodeWatches.js';

/**
 * The start dates of the first viewings of the watched episodes among `keys`, or null when none is watched or
 * some first viewing has no start date (an episode watched on an unknown date, or only with a finish date).
 */
export function firstViewingStarts(
  keys: readonly string[],
  watches: EpisodeWatches,
): string[] | null {
  const starts: string[] = [];
  for (const key of keys) {
    const viewings = watches[key];
    if (viewings === undefined) continue;
    const start = viewings[0]?.startedAt;
    if (start === undefined || start === null) return null;
    starts.push(start);
  }
  return starts.length === 0 ? null : starts;
}
