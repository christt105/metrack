import type { Series } from '../Series.js';
import type { LibrarySeries } from './LibrarySeries.js';
import type { SyncState } from './SyncState.js';

/** The stored series a library series is: the same Jellyfin id, or else the same TheTVDB id, or else the same TMDB id. */
export function findStoredSeries(state: SyncState, item: LibrarySeries): Series | undefined {
  return (
    state.series.find((s) => s.jellyfinId === item.jellyfinId) ??
    (item.tvdbId === null ? undefined : state.series.find((s) => s.tvdbId === item.tvdbId)) ??
    (item.tmdbId === null ? undefined : state.series.find((s) => s.tmdbId === item.tmdbId))
  );
}
