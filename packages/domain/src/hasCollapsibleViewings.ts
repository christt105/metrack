import { collapseUndatedViewing } from './collapseUndatedViewing.js';
import type { EpisodeWatches } from './EpisodeWatches.js';

/**
 * Whether some episode of the watches has an unknown-date viewing followed by a dated one that
 * `collapseUndatedViewing` would merge for at least one of the season finishes. Without knowing which season an
 * episode is in, this is the cheapest test for whether a planner pass could still change the watches.
 */
export function hasCollapsibleViewings(
  watches: EpisodeWatches,
  seasonFinishes: readonly (string | null)[],
): boolean {
  const finishes = seasonFinishes.length === 0 ? [null] : seasonFinishes;
  return Object.values(watches).some((viewings) =>
    finishes.some((finish) => collapseUndatedViewing(viewings, finish).length !== viewings.length),
  );
}
