import type { SyncPlan } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { PlanTitles } from './PlanTitles.js';

/**
 * Refuses a plan that names a movie, series or season the user does not have, or a season of another series. `owned`
 * needs to hold only the titles the plan names (see `loadPlanTitles`).
 */
export function assertPlanOwned(plan: SyncPlan, owned: PlanTitles): void {
  const movies = new Set(owned.movies.map((movie) => movie.id));
  const series = new Set(owned.series.map((entry) => entry.id));
  const seasonSeries = new Map(owned.seasons.map((season) => [season.id, season.seriesId]));
  const foreign = (what: string, id: number): ApiError =>
    ApiError.badRequest(
      'plan_foreign_id',
      `The plan names ${what} ${id}, which is not this user's`,
    );
  for (const change of plan.movies) {
    if (change.movieId !== null && !movies.has(change.movieId)) {
      throw foreign('movie', change.movieId);
    }
  }
  for (const change of plan.series) {
    if (change.seriesId !== null && !series.has(change.seriesId)) {
      throw foreign('series', change.seriesId);
    }
    for (const season of change.seasons) {
      if (season.seasonId === null) continue;
      if (change.seriesId === null || seasonSeries.get(season.seasonId) !== change.seriesId) {
        throw foreign('season', season.seasonId);
      }
    }
  }
}
