import type { EpisodeWatches } from './EpisodeWatches.js';
import { liveViewings } from './liveViewings.js';

/**
 * The watches without their abandoned viewings. An episode with an empty list (watched on an unknown date) is kept;
 * one left with no live viewing is dropped. Returns the same object when nothing is abandoned.
 */
export function liveWatches(watches: EpisodeWatches): EpisodeWatches {
  if (!Object.values(watches).some((viewings) => viewings.some((v) => v.abandonedAt !== undefined)))
    return watches;
  const live: EpisodeWatches = {};
  for (const [key, viewings] of Object.entries(watches)) {
    const kept = liveViewings(viewings);
    if (viewings.length === 0 || kept.length > 0) live[key] = kept;
  }
  return live;
}
