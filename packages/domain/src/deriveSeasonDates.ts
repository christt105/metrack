import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import type { SeasonTracking } from './SeasonTracking.js';

function earliest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a <= b ? a : b));
}

function latest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a >= b ? a : b));
}

/**
 * The dates a season takes from its watched episodes. The start is the earliest start among the first dated
 * viewings of its watched episodes (a viewing without a start counts from its finish); the finish is set once
 * every aired episode is watched, to the latest finish among those first viewings. A date the episodes cannot
 * give, because none has a dated viewing or the season is not fully watched, keeps its stored value.
 */
export function deriveSeasonDates(
  tracking: Pick<SeasonTracking, 'startedAt' | 'finishedAt'>,
  episodes: readonly ExpectedEpisode[],
  watches: EpisodeWatches,
  today: string,
): Pick<SeasonTracking, 'startedAt' | 'finishedAt'> {
  const firsts = episodes.flatMap(({ key }) => {
    const first = (watches[key] ?? []).find((viewing) => viewing.finishedAt !== null);
    return first === undefined ? [] : [first];
  });
  if (firsts.length === 0)
    return { startedAt: tracking.startedAt, finishedAt: tracking.finishedAt };
  const startedAt = earliest(
    firsts.map((viewing) => viewing.startedAt ?? viewing.finishedAt ?? ''),
  );
  const aired = episodes.filter((e) => e.airDate === null || e.airDate <= today);
  const allWatched = aired.length > 0 && aired.every(({ key }) => key in watches);
  return {
    startedAt: startedAt ?? tracking.startedAt,
    finishedAt: allWatched
      ? (latest(
          firsts.flatMap((viewing) => (viewing.finishedAt === null ? [] : [viewing.finishedAt])),
        ) ?? tracking.finishedAt)
      : tracking.finishedAt,
  };
}
