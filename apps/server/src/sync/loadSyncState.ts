import type { SyncState } from '@metrack/domain';
import type { SyncTargets } from './SyncTargets.js';

/** Reads everything the sync compares against. */
export function loadSyncState(targets: SyncTargets): SyncState {
  const series = targets.series.list();
  return {
    movies: targets.movies.list(),
    series,
    seasons: targets.seasons.list(),
    overrides: series.flatMap((s) => targets.overrides.listBySeries(s.id)),
    unlinked: targets.unlinked.list(),
  };
}
