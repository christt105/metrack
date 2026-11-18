import { collectSyncWatchDays } from './collectSyncWatchDays.js';
import { planMovies } from './planMovies.js';
import { planSeries } from './planSeries.js';
import type { SyncInput } from './SyncInput.js';
import type { SyncPlan } from './SyncPlan.js';

/**
 * Compares playback history with what is stored and returns the changes a sync would make.
 * Pure: it reads nothing and writes nothing.
 */
export function planSync(input: SyncInput): SyncPlan {
  const { days, playCount, ignored, unmatched } = collectSyncWatchDays(input);
  const movies = planMovies(input.movies, days, playCount, input.state);
  const series = planSeries(
    input.series,
    days,
    playCount,
    input.state,
    input.today,
    input.indexes ?? new Map(),
  );
  return {
    movies: movies.changes,
    series: series.changes,
    unlinked: [...movies.unlinked, ...series.unlinked],
    warnings: [...movies.warnings, ...series.warnings],
    ignoredPlays: ignored,
    unmatchedTitles: [...unmatched]
      .map(([title, plays]) => ({ title, plays }))
      .sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title)),
  };
}
