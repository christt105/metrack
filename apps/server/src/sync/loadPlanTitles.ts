import type { SyncPlan } from '@metrack/domain';
import type { PlanTitles } from './PlanTitles.js';
import type { SyncTargets } from './SyncTargets.js';

/** Reads only the movies, series and seasons the plan names, instead of the user's whole library. */
export async function loadPlanTitles(plan: SyncPlan, targets: SyncTargets): Promise<PlanTitles> {
  const movieIds = plan.movies.flatMap((change) =>
    change.movieId === null ? [] : [change.movieId],
  );
  const seriesIds = plan.series.flatMap((change) =>
    change.seriesId === null ? [] : [change.seriesId],
  );
  const seasonIds = plan.series.flatMap((change) =>
    change.seasons.flatMap((season) => (season.seasonId === null ? [] : [season.seasonId])),
  );
  return {
    movies: await targets.movies.getMany(movieIds),
    series: await targets.series.getMany(seriesIds),
    seasons: await targets.seasons.getMany(seasonIds),
  };
}
