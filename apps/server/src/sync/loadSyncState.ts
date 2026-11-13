import type { SyncState } from '@metrack/domain';
import type { SyncTargets } from './SyncTargets.js';

/** Reads everything the sync compares against. */
export async function loadSyncState(targets: SyncTargets): Promise<SyncState> {
  return {
    movies: await targets.movies.list(),
    series: await targets.series.list(),
    seasons: await targets.seasons.list(),
    overrides: await targets.overrides.list(),
    unlinked: await targets.unlinked.list(),
  };
}
