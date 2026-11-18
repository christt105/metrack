import type { EpisodeWatches } from './EpisodeWatches.js';
import { isUndatedWatch } from './isUndatedWatch.js';

/** The keys among `keys` that have a dated viewing, so they cannot be skipped. */
export function skipBlockers(watches: EpisodeWatches, keys: readonly string[]): string[] {
  return keys.filter((key) => watches[key] !== undefined && !isUndatedWatch(watches[key]));
}
