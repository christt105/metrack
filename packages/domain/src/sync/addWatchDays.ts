import type { EpisodeWatches } from '../EpisodeWatches.js';

/** Adds one viewing per day to the episode's key, each starting and ending that day. */
export function addWatchDays(incoming: EpisodeWatches, key: string, days: readonly string[]): void {
  incoming[key] = [
    ...(incoming[key] ?? []),
    ...days.map((day) => ({ startedAt: day, finishedAt: day })),
  ];
}
