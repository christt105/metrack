import { collectWatchDays } from './collectWatchDays.js';
import { makeDateOf } from './makeDateOf.js';
import { planMovies } from './planMovies.js';
import { planSeries } from './planSeries.js';
import type { SyncInput } from './SyncInput.js';
import type { SyncPlan } from './SyncPlan.js';

/**
 * Compares playback history with what is stored and returns the changes a sync would make.
 * Pure: it reads nothing and writes nothing.
 */
export function planSync(input: SyncInput): SyncPlan {
  const runtimes = new Map<string, number | null>();
  for (const movie of input.movies) runtimes.set(movie.jellyfinId, movie.runtimeSeconds);
  for (const series of input.series) {
    for (const season of series.seasons) {
      for (const episode of season.episodes)
        runtimes.set(episode.jellyfinId, episode.runtimeSeconds);
    }
  }
  const played = new Set<string>();
  for (const movie of input.movies) if (movie.played) played.add(movie.jellyfinId);
  for (const series of input.series) {
    for (const season of series.seasons) {
      for (const episode of season.episodes) if (episode.played) played.add(episode.jellyfinId);
    }
  }
  const { days, playCount, ignored, unmatched } = collectWatchDays(
    input.plays,
    runtimes,
    makeDateOf(input.timeZone),
    played,
  );
  const movies = planMovies(input.movies, days, playCount, input.state);
  const series = planSeries(input.series, days, playCount, input.state, input.today);
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
