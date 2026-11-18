import { deriveSeasonDates } from './deriveSeasonDates.js';
import { deriveSeasonTracking } from './deriveSeasonTracking.js';
import { isUnrecordedCompletion } from './materializeCompletedSeasons.js';
import type { SeasonEntryUpdate } from './SeasonEntryUpdate.js';
import type { SeasonTracking } from './SeasonTracking.js';
import type { SeriesTrackingInput } from './SeriesTrackingInput.js';

/**
 * Recomputes the season entries of a series from the user's watches: each season's `watched_count`, and its
 * status, dates and rewatches as `deriveSeasonTracking` says (only dates with `datesOnly`). Returns only the
 * entries that differ from what they hold. With `keepUnrecorded`, a completed season that records no episode of
 * its own is left alone, because its stored count is all there is to go by.
 */
export function deriveSeriesTracking(input: SeriesTrackingInput): SeasonEntryUpdate[] {
  const updates: SeasonEntryUpdate[] = [];
  for (const season of input.seasons) {
    if (
      season.episodes.length === 0 ||
      (input.keepUnrecorded === true && isUnrecordedCompletion(season, input.watches))
    )
      continue;
    const before: SeasonTracking = season.tracking;
    const watchedCount = season.episodes.filter(({ key }) => key in input.watches).length;
    let tracking: SeasonTracking = before;
    let completes = false;
    if (input.datesOnly) {
      if (before.status !== 'dropped') {
        tracking = {
          ...before,
          ...deriveSeasonDates(before, season.episodes, input.watches, input.today),
        };
      }
    } else {
      const derived = deriveSeasonTracking({
        tracking: before,
        episodes: season.episodes,
        watches: input.watches,
        ...(input.baseline ? { baseline: input.baseline } : {}),
        today: input.today,
      });
      tracking = {
        status: derived.status,
        startedAt: derived.startedAt,
        finishedAt: derived.finishedAt,
        rewatches: derived.rewatches,
      };
      completes = derived.completes;
    }
    if (
      watchedCount === season.watchedCount &&
      JSON.stringify(tracking) === JSON.stringify(before)
    ) {
      continue;
    }
    updates.push({ seasonId: season.seasonId, watchedCount, tracking, completes });
  }
  return updates;
}
