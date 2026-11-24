import type { EpisodeWatches } from './EpisodeWatches.js';

/** The outcome of starting a season over or taking that back: the new watches of the series, or why it cannot be. */
export type RestartResult =
  | { ok: true; watches: EpisodeWatches }
  | { ok: false; reason: 'not_in_progress' | 'nothing_watched' | 'same_day' | 'none' };
