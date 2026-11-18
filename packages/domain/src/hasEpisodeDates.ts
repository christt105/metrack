import type { EpisodeWatches } from './EpisodeWatches.js';
import { firstViewingStarts } from './firstViewingStarts.js';

/** Whether a season's start date follows its episodes: some are watched and every first viewing has a start. */
export function hasEpisodeDates(keys: readonly string[], watches: EpisodeWatches): boolean {
  return firstViewingStarts(keys, watches) !== null;
}
