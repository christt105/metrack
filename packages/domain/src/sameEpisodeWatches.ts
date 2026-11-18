import type { EpisodeWatches } from './EpisodeWatches.js';

/** Whether two watches hold the same episodes with the same viewings, in any key order. */
export function sameEpisodeWatches(a: EpisodeWatches, b: EpisodeWatches): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const other = b[key];
    return other !== undefined && JSON.stringify(a[key]) === JSON.stringify(other);
  });
}
