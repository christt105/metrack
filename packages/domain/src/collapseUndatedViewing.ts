import type { Viewing } from './Viewing.js';

/**
 * Drops the viewing on an unknown date that comes first when a dated viewing follows it, since that viewing is
 * the same watch seen twice. The dated viewing is kept as the first one, unless it finished after `seasonFinish`,
 * the finish of the season the user recorded: that one is a rewatch and the unknown-date viewing stays. A season
 * without a finish (`null`) never keeps it. Viewings in canonical form, see `normalizeViewings`.
 */
export function collapseUndatedViewing(
  viewings: readonly Viewing[],
  seasonFinish: string | null,
): Viewing[] {
  const [first, second] = viewings;
  if (first === undefined || second === undefined) return [...viewings];
  if (first.startedAt !== null || first.finishedAt !== null) return [...viewings];
  if (second.finishedAt === null) return [...viewings];
  if (seasonFinish !== null && second.finishedAt > seasonFinish) return [...viewings];
  return viewings.slice(1);
}
