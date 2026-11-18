import type { Season } from '@metrack/domain';

/**
 * How many episodes of a season count as watched, or null when there is no progress to show. The count comes from
 * the user's watched episodes; a completed season without any stored watches counts as all of them.
 */
export function seasonWatched(season: Season): number | null {
  if (season.watchedCount > 0) return season.watchedCount;
  if (season.status === 'completed' && season.episodeCount !== null) return season.episodeCount;
  return null;
}
