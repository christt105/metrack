import type { SeasonTracking } from './SeasonTracking.js';

/** The outcome of starting a season over: its tracking, or why it cannot be. */
export type RestartResult =
  | { ok: true; tracking: SeasonTracking }
  | { ok: false; reason: 'not_in_progress' | 'nothing_watched' | 'same_day' };
