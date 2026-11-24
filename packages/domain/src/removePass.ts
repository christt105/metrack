import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { isUndatedWatch } from './isUndatedWatch.js';
import { normalizeViewings } from './normalizeViewings.js';
import { ownPasses } from './ownPasses.js';
import type { RemovePassResult } from './RemovePassResult.js';

/**
 * Deletes pass `pass` (1 is the first time) of a season: the `pass`-th live viewing of every episode that has one,
 * in the canonical order of `ownPasses`. Abandoned viewings are kept. An episode left with no live viewing and no
 * abandoned one is no longer watched. Refused with `not_found` when no episode has such a viewing.
 */
export function removePass(
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
  pass: number,
): RemovePassResult {
  const own = ownPasses(episodes, watches);
  const result = { ...watches };
  let removed = false;
  for (const { key } of episodes) {
    const live = own.get(key) ?? [];
    if (live.length < pass) continue;
    removed = true;
    const abandoned = (watches[key] ?? []).filter((viewing) => viewing.abandonedAt !== undefined);
    const rest = live.filter((_, at) => at !== pass - 1);
    if (rest.length === 0) {
      if (abandoned.length === 0) delete result[key];
      else result[key] = abandoned;
    } else {
      result[key] =
        abandoned.length === 0 && rest.length === 1 && isUndatedWatch(rest)
          ? []
          : normalizeViewings([...abandoned, ...rest]);
    }
  }
  return removed ? { ok: true, watches: result } : { ok: false, reason: 'not_found' };
}
