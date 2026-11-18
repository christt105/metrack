import type { Viewing } from './Viewing.js';

/**
 * The episodes of one series a user has watched, keyed by `episodeKey`. An episode is watched when its key is
 * present; an empty list means it was watched on an unknown date.
 */
export type EpisodeWatches = Record<string, Viewing[]>;
