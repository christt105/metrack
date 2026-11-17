import type { EpisodeWatches } from './EpisodeWatches.js';

/** How many distinct episodes are watched. */
export function countWatchedEpisodes(watches: EpisodeWatches): number {
  return Object.keys(watches).length;
}
