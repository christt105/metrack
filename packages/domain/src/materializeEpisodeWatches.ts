import type { EpisodeWatches } from './EpisodeWatches.js';

/** The watches of a completed season that has none stored: every episode from 1 to `episodeCount`, watched on an unknown date. */
export function materializeEpisodeWatches(episodeCount: number): EpisodeWatches {
  const watches: EpisodeWatches = {};
  for (let number = 1; number <= episodeCount; number += 1) watches[String(number)] = [];
  return watches;
}
