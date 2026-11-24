import type { Episode } from './Episode.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import { episodeKey } from './episodeKey.js';
import { liveWatches } from './liveWatches.js';

/** How many of the season's episodes are watched, not counting abandoned viewings; `seasonNumber` is the season's metrack number. */
export function countWatchedEpisodes(
  episodes: readonly Episode[],
  seasonNumber: number,
  watches: EpisodeWatches,
): number {
  const live = liveWatches(watches);
  return episodes.filter((episode) => episodeKey(episode, seasonNumber) in live).length;
}
