import type { EpisodeWatches } from './EpisodeWatches.js';
import { normalizeViewings } from './normalizeViewings.js';
import type { Viewing } from './Viewing.js';

function isDuplicate(a: Viewing, b: Viewing): boolean {
  if (a.finishedAt !== b.finishedAt) return false;
  return a.startedAt === null || b.startedAt === null || a.startedAt === b.startedAt;
}

/**
 * Adds the incoming viewings to the stored watches and never removes any. A viewing is a duplicate when it has the
 * same finish date and, if both have a start, the same start. An episode only in `incoming` becomes watched, with
 * an empty list when it has no viewings.
 */
export function mergeEpisodeWatches(
  stored: EpisodeWatches,
  incoming: EpisodeWatches,
): EpisodeWatches {
  const merged: EpisodeWatches = {};
  for (const [key, viewings] of Object.entries(stored)) merged[key] = viewings;
  for (const [key, viewings] of Object.entries(incoming)) {
    const current = merged[key];
    if (current === undefined) {
      merged[key] = normalizeViewings(viewings);
      continue;
    }
    const added = viewings.filter(
      (viewing) => !current.some((other) => isDuplicate(other, viewing)),
    );
    if (added.length > 0) merged[key] = normalizeViewings([...current, ...added]);
  }
  return merged;
}
