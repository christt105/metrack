import type { EpisodeWatches } from './EpisodeWatches.js';

/** What a user recorded of the episodes of one series: the ones watched and the keys of the ones skipped. */
export interface EpisodeState {
  watches: EpisodeWatches;
  skipped: readonly string[];
}
