import type { EpisodeWatches } from './EpisodeWatches.js';
import { readViewings } from './readViewings.js';

/**
 * Reads the watched episodes from stored or submitted data. Keys that are not positive whole numbers are
 * dropped, a value that is not a list counts as watched on an unknown date, and each list is normalized as
 * viewings. Anything that is not an object gives no watched episodes.
 */
export function normalizeEpisodeWatches(raw: unknown): EpisodeWatches {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const watches: EpisodeWatches = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^[1-9]\d*$/.test(key)) continue;
    watches[key] = Array.isArray(value) ? readViewings(value) : [];
  }
  return watches;
}
