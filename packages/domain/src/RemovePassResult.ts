import type { EpisodeWatches } from './EpisodeWatches.js';

/** The outcome of deleting a pass: the new watches of the series, or `not_found` when no episode has that pass. */
export type RemovePassResult =
  { ok: true; watches: EpisodeWatches } | { ok: false; reason: 'not_found' };
