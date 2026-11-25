import type { ComputedSeasonTracking } from './ComputedSeasonTracking.js';
import type { ExpectedEpisode } from './ExpectedEpisode.js';
import { countCompletePasses } from './countCompletePasses.js';
import { normalizeViewings } from './normalizeViewings.js';
import { ownPasses } from './ownPasses.js';
import type { SeasonTracking } from './SeasonTracking.js';
import type { SeasonTrackingInput } from './SeasonTrackingInput.js';
import type { Viewing } from './Viewing.js';

type Passes = Map<string, Viewing[]>;

function earliest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a <= b ? a : b));
}

function latest(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a >= b ? a : b));
}

function startOf(viewing: Viewing): string | null {
  return viewing.startedAt ?? viewing.finishedAt;
}

function finishOf(viewing: Viewing): string | null {
  return viewing.finishedAt ?? viewing.startedAt;
}

function isAired(episode: ExpectedEpisode, today: string): boolean {
  return episode.airDate === null || episode.airDate <= today;
}

function nthViewings(own: Passes, pass: number): Viewing[] {
  return [...own.values()].flatMap((viewings) => {
    const viewing = viewings[pass - 1];
    return viewing === undefined ? [] : [viewing];
  });
}

function passDates(
  own: Passes,
  pass: number,
): { startedAt: string | null; finishedAt: string | null } {
  const viewings = nthViewings(own, pass);
  return {
    startedAt: earliest(
      viewings.flatMap((v) => (startOf(v) === null ? [] : [startOf(v) as string])),
    ),
    finishedAt: latest(
      viewings.flatMap((v) => (finishOf(v) === null ? [] : [finishOf(v) as string])),
    ),
  };
}

function firstPassDates(
  own: Passes,
  episodes: readonly ExpectedEpisode[],
  firstPassComplete: boolean,
  today: string,
  skipped: ReadonlySet<string>,
  stored: { startedAt: string | null; finishedAt: string | null },
): { startedAt: string | null; finishedAt: string | null } {
  const firsts = nthViewings(own, 1);
  const result = { ...stored };
  if (firsts.length > 0 && firsts.every((v) => v.startedAt !== null)) {
    result.startedAt = earliest(firsts.map((v) => v.startedAt as string));
  }
  const aired = episodes.filter((e) => !skipped.has(e.key) && isAired(e, today));
  const allAiredWatched = aired.length > 0 && aired.every((e) => own.has(e.key));
  const datedFinishes = firsts.flatMap((v) => (v.finishedAt === null ? [] : [v.finishedAt]));
  if ((firstPassComplete || allAiredWatched) && datedFinishes.length > 0) {
    result.finishedAt = latest(datedFinishes);
  }
  const regenerable = firsts.every((v) => v.finishedAt !== null);
  if (!firstPassComplete && !allAiredWatched && regenerable) result.finishedAt = null;
  if (
    result.startedAt !== null &&
    result.finishedAt !== null &&
    result.startedAt > result.finishedAt
  ) {
    if (firstPassComplete) result.startedAt = result.finishedAt;
    else result.finishedAt = null;
  }
  return result;
}

function remembered(
  tracking: SeasonTracking,
  previouslyEmpty: boolean,
): Pick<SeasonTracking, 'manual'> {
  if (tracking.manual) return { manual: tracking.manual };
  if (!previouslyEmpty) return {};
  const { status, startedAt, finishedAt } = tracking;
  return { manual: { status, startedAt, finishedAt } };
}

/**
 * A catalog season's status, dates, rewatches and counters, computed from scratch from the viewings of its
 * episodes, the episodes skipped, the user's intention to watch it again and today. Nothing depends on what was
 * written before except what the episodes cannot say: the season's own dates while its first pass has undated
 * viewings (a complete first pass still finishes at its latest dated one), and how many rewatches were closed, which tells that a pass the user asked for has just completed.
 *
 * Pass N is the N-th viewing of each episode. The first pass is complete when every episode that is not skipped has
 * aired and has a viewing, which makes the season completed (otherwise in progress, a planned or paused season
 * included); a later pass is complete when every aired episode that is not skipped has that many viewings. The
 * first pass starts at its earliest first viewing, keeping the stored start while some first viewing has no date; a
 * complete first pass finishes at its latest first viewing that has a date, keeping the stored finish when none has
 * one; an unfinished first pass has no finish unless some first viewing has no date to give it. A start
 * after the finish is brought back to it. Every complete later pass is a rewatch, from its earliest start to its
 * latest finish. An incomplete pass that follows the complete ones with at least one dated viewing is an open
 * rewatch while the intention to watch again is set or while the pass has a viewing of each of the first two
 * episodes that are not skipped (the season is being started over; watching loose episodes is not), and the
 * intention is cleared once a rewatch completes. A season without a single viewing goes back to the status and
 * dates it had before the first one (`manual`, kept when the first viewing appears), and a dropped season keeps its
 * tracking as the user left it. Abandoned viewings (see `Viewing.abandonedAt`) are not viewings here; a season whose
 * only viewings were abandoned is in progress with no dates.
 */
export function computeSeasonTracking(input: SeasonTrackingInput): ComputedSeasonTracking {
  const { tracking, episodes, today } = input;
  const skipped = input.skipped ?? new Set<string>();
  const own = ownPasses(episodes, input.watches);
  const watchedCount = own.size;
  const skippedCount = episodes.filter((e) => skipped.has(e.key)).length;
  const unchanged: ComputedSeasonTracking = {
    tracking: { ...tracking, rewatches: [...tracking.rewatches] },
    watchedCount,
    skippedCount,
    completes: false,
  };
  if (tracking.status === 'dropped') return unchanged;
  if (watchedCount === 0) {
    const abandoned = episodes.some(({ key }) =>
      input.watches[key]?.some((viewing) => viewing.abandonedAt !== undefined),
    );
    if (abandoned) {
      return {
        ...unchanged,
        tracking: {
          ...unchanged.tracking,
          status: 'in_progress',
          startedAt: null,
          finishedAt: null,
          rewatches: [],
        },
      };
    }
    const { manual } = tracking;
    if (!manual) return unchanged;
    const restored: SeasonTracking = { ...unchanged.tracking, ...manual };
    delete restored.manual;
    return { ...unchanged, tracking: restored };
  }

  const required = episodes.filter((e) => !skipped.has(e.key));
  const completePasses = countCompletePasses(own, episodes, skipped, today);
  const most = Math.max(...[...own.values()].map((v) => v.length));
  const firstPassComplete = completePasses >= 1;
  const status = firstPassComplete ? 'completed' : 'in_progress';
  const rewatches: Viewing[] = [];
  for (let pass = 2; pass <= completePasses; pass += 1) rewatches.push(passDates(own, pass));
  const closedBefore = tracking.rewatches.filter((v) => v.finishedAt !== null).length;
  const wantsRewatch = tracking.wantsRewatch && completePasses - 1 <= closedBefore;
  const startsOver = required
    .slice(0, 2)
    .every((e) => (own.get(e.key)?.length ?? 0) >= completePasses + 1);
  if ((wantsRewatch || startsOver) && firstPassComplete && most > completePasses) {
    const { startedAt } = passDates(own, completePasses + 1);
    if (startedAt !== null) rewatches.push({ startedAt, finishedAt: null });
  }
  const dates = firstPassDates(own, episodes, firstPassComplete, today, skipped, tracking);
  return {
    tracking: {
      status,
      startedAt: dates.startedAt,
      finishedAt: dates.finishedAt,
      rewatches: normalizeViewings(rewatches),
      wantsRewatch,
      ...remembered(tracking, input.previouslyEmpty === true),
    },
    watchedCount,
    skippedCount,
    completes: status === 'completed' && tracking.status !== 'completed',
  };
}
