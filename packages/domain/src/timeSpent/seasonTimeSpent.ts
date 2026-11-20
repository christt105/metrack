import { averageRuntime } from './averageRuntime.js';
import type { SeasonTimeInput } from './SeasonTimeInput.js';
import { tallyTimeSpent } from './tallyTimeSpent.js';
import type { TimedViewing } from './TimedViewing.js';
import type { TimeSpent } from './TimeSpent.js';
import { yearOfDate } from './yearOfDate.js';

/**
 * The time spent on a season: the running time of every viewing of every watched episode, rewatches included. An episode without a running time takes the season's average, then the series' usual one, and counts for nothing when there is neither. Skipped episodes do not count. A season without a catalog, or a completed one that records no watches, counts its watched episodes at the series' usual running time, placed in the year the season finished.
 */
export function seasonTimeSpent(input: SeasonTimeInput): TimeSpent | null {
  const { episodes, watches, skipped } = input;
  const usual = episodes === null ? null : (averageRuntime(episodes) ?? input.seriesRuntime);
  const viewings: TimedViewing[] = [];
  let recorded = 0;
  for (const episode of episodes ?? []) {
    const stored = watches[episode.key];
    if (stored === undefined || skipped.has(episode.key)) continue;
    recorded += 1;
    const minutes = episode.runtime !== null && episode.runtime > 0 ? episode.runtime : usual;
    if (minutes === null) continue;
    if (stored.length === 0) viewings.push({ year: null, minutes });
    for (const viewing of stored) viewings.push({ year: yearOfDate(viewing.finishedAt), minutes });
  }
  if (recorded === 0 && input.watchedCount > 0) {
    const minutes = usual ?? input.seriesRuntime;
    if (minutes !== null) {
      viewings.push({
        year: yearOfDate(input.finishedAt),
        minutes: minutes * input.watchedCount,
      });
    }
  }
  return tallyTimeSpent(viewings);
}
