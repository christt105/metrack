import { collapseUndatedViewing } from './collapseUndatedViewing.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import { liveViewings } from './liveViewings.js';
import { normalizeViewings } from './normalizeViewings.js';
import type { Viewing } from './Viewing.js';

function isDuplicate(a: Viewing, b: Viewing): boolean {
  if (a.finishedAt !== b.finishedAt) return false;
  return a.startedAt === null || b.startedAt === null || a.startedAt === b.startedAt;
}

/**
 * Adds the incoming viewings to the stored watches and never removes any. A viewing is a duplicate when it has the
 * same finish date and, if both have a start, the same start. An episode only in `incoming` becomes watched, with
 * an empty list when it has no viewings. An episode watched on an unknown date (an empty list) keeps that as its first viewing, a viewing with neither date, when dated viewings are added.
 * `seasonFinish` gives, for the episodes of seasons the user has an entry for, the finish date of that season
 * (null when it has none): there the dated viewing replaces the unknown-date first one, and so it does for an
 * episode already stored with both, unless it finished after the season did and so is a rewatch, see
 * `collapseUndatedViewing`. A viewing equal to an abandoned one is a duplicate too, so a play already abandoned is not
 * added back, unless `matchAbandoned` is false.
 */
export function mergeEpisodeWatches(
  stored: EpisodeWatches,
  incoming: EpisodeWatches,
  seasonFinish: ReadonlyMap<string, string | null> = new Map(),
  matchAbandoned = true,
): EpisodeWatches {
  const merged: EpisodeWatches = {};
  for (const [key, viewings] of Object.entries(stored)) merged[key] = viewings;
  for (const [key, viewings] of Object.entries(incoming)) {
    const current = merged[key];
    if (current === undefined) {
      merged[key] = normalizeViewings(viewings);
      continue;
    }
    if (viewings.length === 0 && current.length > 0 && liveViewings(current).length === 0) {
      merged[key] = normalizeViewings([...current, { startedAt: null, finishedAt: null }]);
      continue;
    }
    const known = matchAbandoned ? current : liveViewings(current);
    const added = viewings.filter((viewing) => !known.some((other) => isDuplicate(other, viewing)));
    if (added.length === 0) continue;
    const first: Viewing[] = current.length === 0 ? [{ startedAt: null, finishedAt: null }] : [];
    merged[key] = normalizeViewings([...first, ...current, ...added]);
  }
  for (const [key, finish] of seasonFinish) {
    const viewings = merged[key];
    if (viewings !== undefined) merged[key] = collapseUndatedViewing(viewings, finish);
  }
  return merged;
}
