import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { firstViewingStarts } from './firstViewingStarts.js';
import type { SeasonTracking } from './SeasonTracking.js';

function earliest(dates: readonly string[]): string {
  return dates.reduce((a, b) => (a <= b ? a : b));
}

function latest(dates: readonly string[]): string {
  return dates.reduce((a, b) => (a >= b ? a : b));
}

/**
 * The dates a season takes from its watched episodes, never replacing what is known with less. The start is the
 * earliest start among the first viewings of its watched episodes, and only when every one of them has a start
 * date. The finish is the latest finish among those first viewings, and only when every aired episode is watched
 * and every first viewing is dated. Otherwise the stored value stays.
 */
export function deriveSeasonDates(
  tracking: Pick<SeasonTracking, 'startedAt' | 'finishedAt'>,
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
  today: string,
): Pick<SeasonTracking, 'startedAt' | 'finishedAt'> {
  const keys = episodes.map((episode) => episode.key);
  const starts = firstViewingStarts(keys, watches);
  const result = { startedAt: tracking.startedAt, finishedAt: tracking.finishedAt };
  if (starts !== null) result.startedAt = earliest(starts);
  const aired = episodes.filter((e) => e.airDate === null || e.airDate <= today);
  const finishes = keys.flatMap((key) =>
    key in watches ? [watches[key]?.[0]?.finishedAt ?? null] : [],
  );
  const dated = finishes.filter((finish): finish is string => finish !== null);
  if (
    aired.length > 0 &&
    aired.every(({ key }) => key in watches) &&
    dated.length > 0 &&
    dated.length === finishes.length
  ) {
    result.finishedAt = latest(dated);
  }
  return result;
}
