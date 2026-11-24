import type { EpisodeWatches } from './EpisodeWatches.js';
import { isUndatedWatch } from './isUndatedWatch.js';
import { liveViewings } from './liveViewings.js';

/** The keys among `keys` that have a dated viewing, so they cannot be skipped. */
export function skipBlockers(watches: EpisodeWatches, keys: readonly string[]): string[] {
  return keys.filter(
    (key) => watches[key] !== undefined && !isUndatedWatch(liveViewings(watches[key])),
  );
}
