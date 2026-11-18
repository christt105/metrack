import type { DerivedSeasonTracking } from './DerivedSeasonTracking.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { normalizeViewings } from './normalizeViewings.js';
import type { SeasonTrackingInput } from './SeasonTrackingInput.js';
import type { Viewing } from './Viewing.js';

function datedViewings(watches: EpisodeWatches, number: number): Viewing[] {
  return (watches[String(number)] ?? []).filter((viewing) => viewing.finishedAt !== null);
}

function earliest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a <= b ? a : b));
}

function latest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a >= b ? a : b));
}

function startDates(watches: EpisodeWatches): string[] {
  return Object.values(watches).flatMap((viewings) =>
    viewings.flatMap((viewing) => {
      const date = viewing.startedAt ?? viewing.finishedAt;
      return date === null ? [] : [date];
    }),
  );
}

function lastFinish(input: SeasonTrackingInput): string | null {
  const { finishedAt, rewatches } = input.tracking;
  return latest([
    ...(finishedAt === null ? [] : [finishedAt]),
    ...rewatches.flatMap((viewing) => (viewing.finishedAt === null ? [] : [viewing.finishedAt])),
  ]);
}

function firstViewingDates(
  watches: EpisodeWatches,
  episodes: readonly ExpectedEpisode[],
): string[] {
  return episodes.flatMap(({ number }) => {
    const first = datedViewings(watches, number)[0]?.finishedAt;
    return first === undefined || first === null ? [] : [first];
  });
}

function isKnown(baseline: EpisodeWatches | undefined, key: string, viewing: Viewing): boolean {
  return (
    baseline?.[key]?.some(
      (other) => other.finishedAt === viewing.finishedAt && other.startedAt === viewing.startedAt,
    ) ?? false
  );
}

function rewatchStart(
  watches: EpisodeWatches,
  after: string,
  baseline: EpisodeWatches | undefined,
): string | null {
  const starts = Object.entries(watches).flatMap(([key, viewings]) =>
    viewings.flatMap((viewing) => {
      if (viewing.finishedAt === null || viewing.finishedAt <= after) return [];
      if (isKnown(baseline, key, viewing)) return [];
      return [
        viewing.startedAt !== null && viewing.startedAt > after
          ? viewing.startedAt
          : viewing.finishedAt,
      ];
    }),
  );
  return earliest(starts);
}

function rewatchFinish(
  watches: EpisodeWatches,
  aired: readonly ExpectedEpisode[],
  startedAt: string,
): string | null {
  if (aired.length === 0) return null;
  const firsts: string[] = [];
  for (const { number } of aired) {
    const date = earliest(
      datedViewings(watches, number).flatMap((viewing) =>
        viewing.finishedAt !== null && viewing.finishedAt >= startedAt ? [viewing.finishedAt] : [],
      ),
    );
    if (date === null) return null;
    firsts.push(date);
  }
  return latest(firsts);
}

/**
 * Moves a season's tracking along with its watched episodes, the same way for manual marking and the Jellyfin
 * sync. The first watched episode starts a planned or paused season (the start is the earliest viewing date, when
 * there is one). Once every expected episode is watched and none is still to air, the season completes on the
 * latest first viewing date; completing never invents a start. A completed season with a viewing dated after its
 * last finish that is not in `baseline` opens a rewatch starting that day, and the rewatch closes on the latest of the dates that watched
 * every aired episode again. At most one rewatch is open and it is the last. Dropped seasons never change, and
 * removing episodes never changes anything because nothing here reacts to a missing viewing.
 */
export function deriveSeasonTracking(input: SeasonTrackingInput): DerivedSeasonTracking {
  const { tracking, watches, today } = input;
  const unchanged: DerivedSeasonTracking = { ...tracking, completes: false };
  if (tracking.status === 'dropped') return unchanged;
  const watchedAny = Object.keys(watches).length > 0;
  if (!watchedAny) return unchanged;

  if (tracking.status === 'completed') return deriveRewatch(input);

  const next: DerivedSeasonTracking = { ...tracking, completes: false };
  if (next.startedAt === null) next.startedAt = earliest(startDates(watches));
  if (next.status === 'planned' || next.status === 'paused') next.status = 'in_progress';
  const expected = input.episodes;
  const allWatched =
    expected.length > 0 &&
    expected.every(
      (e) => (e.airDate === null || e.airDate <= today) && String(e.number) in watches,
    );
  if (allWatched) {
    next.status = 'completed';
    next.finishedAt = latest(firstViewingDates(watches, expected));
    next.completes = true;
  }
  return next;
}

function deriveRewatch(input: SeasonTrackingInput): DerivedSeasonTracking {
  const { tracking, watches, today } = input;
  const result: DerivedSeasonTracking = { ...tracking, completes: false };
  const aired = input.episodes.filter((e) => e.airDate === null || e.airDate <= today);
  let rewatches = [...tracking.rewatches];
  let open = rewatches.find((viewing) => viewing.finishedAt === null);
  if (open === undefined) {
    const finish = lastFinish(input);
    if (finish === null) return result;
    const startedAt = rewatchStart(watches, finish, input.baseline);
    if (startedAt === null) return result;
    open = { startedAt, finishedAt: null };
    rewatches = [...rewatches, open];
  }
  if (open.startedAt !== null) {
    const finishedAt = rewatchFinish(watches, aired, open.startedAt);
    if (finishedAt !== null) {
      rewatches = rewatches.map((viewing) =>
        viewing === open ? { ...open, finishedAt } : viewing,
      );
    }
  }
  result.rewatches = normalizeViewings(rewatches);
  return result;
}
