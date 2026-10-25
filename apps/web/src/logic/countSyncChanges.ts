import type { SyncPlan } from '@metrack/domain';

/** Number of rows a sync would write: movies, series, seasons and unlinked titles. */
export function countSyncChanges(plan: SyncPlan): number {
  return (
    plan.movies.length +
    plan.series.length +
    plan.series.reduce((sum, series) => sum + series.seasons.length, 0) +
    plan.unlinked.length
  );
}
