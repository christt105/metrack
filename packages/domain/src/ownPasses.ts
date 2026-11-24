import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { liveViewings } from './liveViewings.js';
import { normalizeViewings } from './normalizeViewings.js';
import type { Viewing } from './Viewing.js';

/**
 * The live viewings of each watched episode of the season, in canonical form. An episode watched on an unknown
 * date has one viewing with neither date; one with only abandoned viewings is not watched and is left out.
 */
export function ownPasses(
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
): Map<string, Viewing[]> {
  const own = new Map<string, Viewing[]>();
  for (const { key } of episodes) {
    const stored = watches[key];
    if (stored === undefined) continue;
    if (stored.length === 0) {
      own.set(key, [{ startedAt: null, finishedAt: null }]);
      continue;
    }
    const live = normalizeViewings(liveViewings(stored));
    if (live.length > 0) own.set(key, live);
  }
  return own;
}
