import type { EpisodeWatches } from './EpisodeWatches.js';
import { materializeEpisodeWatches } from './materializeEpisodeWatches.js';
import type { SeriesSeasonInput } from './SeriesSeasonInput.js';

/** A completed season that has a count but none of its episodes in the watches counts as all watched on an unknown date. */
export function isUnrecordedCompletion(
  season: SeriesSeasonInput,
  watches: EpisodeWatches,
  skipped: ReadonlySet<string> = new Set(),
): boolean {
  return (
    season.tracking.status === 'completed' &&
    season.watchedCount > 0 &&
    season.episodes.length > 0 &&
    season.episodes.every(({ key }) => !(key in watches)) &&
    season.episodes.some(({ key }) => !skipped.has(key))
  );
}

/** Adds the unrecorded completed seasons' episodes to the watches, so the first change does not lose that. */
export function materializeCompletedSeasons(
  seasons: readonly SeriesSeasonInput[],
  watches: EpisodeWatches,
  skipped: ReadonlySet<string> = new Set(),
): EpisodeWatches {
  let result = watches;
  for (const season of seasons) {
    if (!isUnrecordedCompletion(season, watches, skipped)) continue;
    result = {
      ...materializeEpisodeWatches(
        season.episodes.map((e) => e.key).filter((key) => !skipped.has(key)),
      ),
      ...result,
    };
  }
  return result;
}
