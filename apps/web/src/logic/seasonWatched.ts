import type { Season } from '@metrack/domain';

/**
 * How many episodes of a season count as watched. Until episodes are tracked one by one only a completed season
 * is known: all of them. Anything else is unknown, so no partial progress is invented.
 */
export function seasonWatched(season: Season): number | null {
  if (season.episodeCount === null) return null;
  return season.status === 'completed' ? season.episodeCount : null;
}
