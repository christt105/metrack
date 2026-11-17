import type { Viewing } from './Viewing.js';

/**
 * The episodes of one season a user has watched, keyed by episode number. An episode is watched when its number
 * is a key; an empty list means it was watched on an unknown date.
 */
export type EpisodeWatches = Record<string, Viewing[]>;
