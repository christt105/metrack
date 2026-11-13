import type { SyncPlan, SyncState } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';

/** Refuses a plan that names a movie, series or season the state does not hold, or a season of another series. */
export function assertPlanOwned(plan: SyncPlan, state: SyncState): void {
  const movies = new Set(state.movies.map((movie) => movie.id));
  const series = new Set(state.series.map((entry) => entry.id));
  const seasonSeries = new Map(state.seasons.map((season) => [season.id, season.seriesId]));
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
