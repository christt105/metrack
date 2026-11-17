import { viewingsFromDates } from '../viewingsFromDates.js';
import type { SyncState } from '../sync/SyncState.js';
import type { WireSyncState } from './WireSyncState.js';

/** Reads what the cloud sent: each finish date is a closed viewing without a start. */
export function fromWireSyncState(state: WireSyncState): SyncState {
  return {
    ...state,
    movies: state.movies.map((m) => ({ ...m, rewatches: viewingsFromDates(m.rewatches) })),
    seasons: state.seasons.map((s) => ({ ...s, rewatches: viewingsFromDates(s.rewatches) })),
  };
}
