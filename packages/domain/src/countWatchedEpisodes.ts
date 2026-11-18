import type { Episode } from './Episode.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import { episodeKey } from './episodeKey.js';

/** How many of the season's episodes are watched; `seasonNumber` is the season's metrack number. */
export function countWatchedEpisodes(
  episodes: readonly Episode[],
  seasonNumber: number,
  watches: EpisodeWatches,
): number {
  return episodes.filter((episode) => episodeKey(episode, seasonNumber) in watches).length;
}
