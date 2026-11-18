import { finishDates } from '../finishDates.js';
import type { SyncState } from '../sync/SyncState.js';
import type { WireSyncState } from './WireSyncState.js';

/** Flattens the viewings of movies and seasons to their finish dates for a connector. */
export function toWireSyncState(state: SyncState): WireSyncState {
  return {
    ...state,
    movies: state.movies.map((m) => ({ ...m, rewatches: finishDates(m.rewatches) })),
    seasons: state.seasons.map((s) => ({
      ...s,
      rewatches: finishDates(s.rewatches),
      viewings: s.rewatches,
    })),
  };
}
