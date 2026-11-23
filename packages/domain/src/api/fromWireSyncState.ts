import { readAbandoned } from '../readAbandoned.js';
import { readViewings } from '../readViewings.js';
import { viewingsFromDates } from '../viewingsFromDates.js';
import type { SyncState } from '../sync/SyncState.js';
import type { WireSyncState } from './WireSyncState.js';

/** Reads what the cloud sent: each finish date is a closed viewing without a start. */
export function fromWireSyncState(state: WireSyncState): SyncState {
  return {
    ...state,
    movies: state.movies.map((m) => ({ ...m, rewatches: viewingsFromDates(m.rewatches) })),
    seasons: state.seasons.map(({ viewings, ...s }) => ({
      ...s,
      rewatches: viewings ? readViewings(viewings) : viewingsFromDates(s.rewatches),
      abandoned: readAbandoned(s.abandoned ?? []),
    })),
  };
}
