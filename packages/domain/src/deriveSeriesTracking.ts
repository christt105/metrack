import { computeSeasonTracking } from './computeSeasonTracking.js';
import { isUnrecordedCompletion } from './materializeCompletedSeasons.js';
import type { SeasonEntryUpdate } from './SeasonEntryUpdate.js';
import type { SeriesSeasonInput } from './SeriesSeasonInput.js';
import type { SeriesTrackingInput } from './SeriesTrackingInput.js';

function isCurrent(
  season: SeriesSeasonInput,
  computed: ReturnType<typeof computeSeasonTracking>,
): boolean {
  return (
    computed.watchedCount === season.watchedCount &&
    computed.skippedCount === season.skippedCount &&
    JSON.stringify(computed.tracking) === JSON.stringify(season.tracking)
  );
}

/**
 * Recomputes the season entries of a series from the user's watches with `computeSeasonTracking`: each season's
 * `watched_count`, `skipped_count`, status, dates, rewatches and intention to watch again. Returns only the
 * entries that differ from what they hold. With `keepUnrecorded`, a completed season that records no episode of its
 * own is left alone, because its stored count is all there is to go by.
 */
export function deriveSeriesTracking(input: SeriesTrackingInput): SeasonEntryUpdate[] {
  const updates: SeasonEntryUpdate[] = [];
  const skipped = new Set(input.skipped ?? []);
  for (const season of input.seasons) {
    if (
      season.episodes.length === 0 ||
      (input.keepUnrecorded === true && isUnrecordedCompletion(season, input.watches, skipped))
    )
      continue;
    const wanted = input.intents?.get(season.seasonId);
    const computed = computeSeasonTracking({
      tracking:
        wanted === undefined ? season.tracking : { ...season.tracking, wantsRewatch: wanted },
      episodes: season.episodes,
      watches: input.watches,
      skipped,
      today: input.today,
    });
    if (isCurrent(season, computed)) continue;
    updates.push({
      seasonId: season.seasonId,
      watchedCount: computed.watchedCount,
      skippedCount: computed.skippedCount,
      tracking: computed.tracking,
      completes: computed.completes,
    });
  }
  return updates;
}
