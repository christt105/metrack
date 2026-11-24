import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { liveWatches } from './liveWatches.js';
import type { SeasonTracking } from './SeasonTracking.js';

/**
 * The tracking of a completed season whose episodes drive it once its catalog has an episode that has aired and is
 * neither watched nor skipped: back to in progress, no longer finished, the start and the viewings kept. Null when
 * nothing changes: the season is not completed, records none of its episodes (its status is then the user's own),
 * is being watched again, or has nothing new to watch. Episodes without an air date are not counted.
 */
export function reopenCompletedSeason(
  tracking: SeasonTracking,
  episodes: readonly ExpectedEpisode[],
  stored: EpisodeWatches,
  skipped: ReadonlySet<string>,
  today: string,
): SeasonTracking | null {
  if (tracking.status !== 'completed') return null;
  const watches = liveWatches(stored);
  if (tracking.rewatches.some((viewing) => viewing.finishedAt === null)) return null;
  if (!episodes.some(({ key }) => key in watches)) return null;
  const owed = episodes.some(
    ({ key, airDate }) =>
      airDate !== null && airDate <= today && !(key in watches) && !skipped.has(key),
  );
  return owed ? { ...tracking, status: 'in_progress', finishedAt: null } : null;
}
