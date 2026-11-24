import type { Viewing } from './Viewing.js';

/** The viewings that count towards the season's passes: the ones not abandoned. */
export function liveViewings(viewings: readonly Viewing[]): Viewing[] {
  return viewings.filter((viewing) => viewing.abandonedAt === undefined);
}
