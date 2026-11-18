import type { EpisodeWatches } from './EpisodeWatches.js';

/** Watches for the given episode keys, each watched on an unknown date. */
export function materializeEpisodeWatches(keys: readonly string[]): EpisodeWatches {
  const watches: EpisodeWatches = {};
  for (const key of keys) watches[key] = [];
  return watches;
}
