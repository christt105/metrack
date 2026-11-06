import type { SyncState } from '@metrack/domain';
import type { SyncTargets } from './SyncTargets.js';

/** Reads everything the sync compares against. */
export async function loadSyncState(targets: SyncTargets): Promise<SyncState> {
  const series = await targets.series.list();
  const overrides = [];
  for (const s of series) overrides.push(...(await targets.overrides.listBySeries(s.id)));
  return {
    movies: await targets.movies.list(),
    series,
    seasons: await targets.seasons.list(),
    overrides,
    unlinked: await targets.unlinked.list(),
  };
}
