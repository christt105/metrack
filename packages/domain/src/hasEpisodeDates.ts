import type { EpisodeWatches } from './EpisodeWatches.js';

/** Whether any of the episodes has a dated viewing, which is what a season takes its dates from. */
export function hasEpisodeDates(keys: readonly string[], watches: EpisodeWatches): boolean {
  return keys.some((key) => (watches[key] ?? []).some((viewing) => viewing.finishedAt !== null));
}
