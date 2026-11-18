import { describe, expect, it } from 'vitest';
import {
  applyEpisodeOperation,
  deriveSeasonDates,
  deriveSeriesTracking,
  hasEpisodeDates,
  materializeCompletedSeasons,
  type ExpectedEpisode,
  type SeriesSeasonInput,
  type Viewing,
} from '../src/index.js';

const TODAY = '2026-11-18';
const view = (finishedAt: string, startedAt: string | null = finishedAt): Viewing => ({
  startedAt,
  finishedAt,
});

const planned = { status: 'planned' as const, startedAt: null, finishedAt: null, rewatches: [] };

function season(
  seasonId: number,
  keys: string[],
  over: Partial<SeriesSeasonInput> = {},
): SeriesSeasonInput {
  return {
    seasonId,
    tracking: planned,
    watchedCount: 0,
    skippedCount: 0,
    episodes: keys.map((key): ExpectedEpisode => ({ key, airDate: '2025-01-01' })),
    ...over,
  };
}

describe('marking an episode', () => {
  it('creates a viewing that starts and ends on the day', () => {
    expect(applyEpisodeOperation({}, { op: 'mark', keys: ['7'], date: '2026-11-18' })).toEqual({
      '7': [{ startedAt: '2026-11-18', finishedAt: '2026-11-18' }],
    });
  });
});

describe('deriveSeasonDates', () => {
  const episodes = ['a', 'b', 'c'].map((key) => ({ key, airDate: '2025-01-01' }));

  it('starts at the earliest start of the first viewings and finishes when every aired episode is watched', () => {
    const watches = {
      a: [view('2026-03-05', '2026-03-04'), view('2026-09-01')],
      b: [view('2026-03-01')],
      c: [view('2026-03-09')],
    };
    expect(
      deriveSeasonDates({ startedAt: null, finishedAt: null }, episodes, watches, TODAY),
    ).toEqual({
      startedAt: '2026-03-01',
      finishedAt: '2026-03-09',
    });
  });

  it('leaves the finish alone while an aired episode is unwatched', () => {
    expect(
      deriveSeasonDates(
        { startedAt: '2026-01-01', finishedAt: '2026-02-02' },
        episodes,
        { a: [view('2026-03-05')] },
        TODAY,
      ),
    ).toEqual({ startedAt: '2026-03-05', finishedAt: '2026-02-02' });
  });

  it('keeps the stored dates when no watched episode has a dated viewing', () => {
    expect(
      deriveSeasonDates(
        { startedAt: '2026-01-01', finishedAt: '2026-02-02' },
        episodes,
        { a: [], b: [], c: [] },
        TODAY,
      ),
    ).toEqual({ startedAt: '2026-01-01', finishedAt: '2026-02-02' });
  });

  it('keeps the stored start when a watched episode has no start date, even if others do', () => {
    const undated = { startedAt: null, finishedAt: null };
    expect(
      deriveSeasonDates(
        { startedAt: '2026-01-01', finishedAt: '2026-02-02' },
        episodes,
        { a: [undated, view('2026-06-01')], b: [view('2026-03-01')], c: [view('2026-03-02')] },
        TODAY,
      ),
    ).toEqual({ startedAt: '2026-01-01', finishedAt: '2026-02-02' });
  });

  it('keeps the stored finish when a first viewing has no finish date', () => {
    expect(
      deriveSeasonDates(
        { startedAt: '2026-01-01', finishedAt: '2026-02-02' },
        episodes,
        { a: [], b: [view('2026-03-01')], c: [view('2026-03-02')] },
        TODAY,
      ),
    ).toEqual({ startedAt: '2026-01-01', finishedAt: '2026-02-02' });
  });

  it('derives both from fully dated manual marking', () => {
    const watches = { a: [view('2026-03-01')], b: [view('2026-03-02')], c: [view('2026-03-03')] };
    expect(
      deriveSeasonDates(
        { startedAt: '2026-01-01', finishedAt: '2026-02-02' },
        episodes,
        watches,
        TODAY,
      ),
    ).toEqual({ startedAt: '2026-03-01', finishedAt: '2026-03-03' });
  });

  it('reports whether the start follows the episodes', () => {
    expect(hasEpisodeDates(['a', 'b'], { a: [view('2026-01-01')], b: [view('2026-01-02')] })).toBe(
      true,
    );
    expect(hasEpisodeDates(['a', 'b'], { a: [], b: [view('2026-01-01')] })).toBe(false);
    expect(hasEpisodeDates(['a', 'b'], { c: [view('2026-01-01')] })).toBe(false);
  });
});

describe('deriveSeriesTracking', () => {
  it('derives status, count and dates of every season from the series watches', () => {
    const updates = deriveSeriesTracking({
      seasons: [season(1, ['a', 'b']), season(2, ['c', 'd'])],
      watches: { a: [view('2026-03-01')], b: [view('2026-03-02')], c: [view('2026-04-01')] },
      today: TODAY,
    });
    expect(updates).toEqual([
      {
        seasonId: 1,
        watchedCount: 2,
        skippedCount: 0,
        completes: true,
        tracking: {
          status: 'completed',
          startedAt: '2026-03-01',
          finishedAt: '2026-03-02',
          rewatches: [],
        },
      },
      {
        seasonId: 2,
        watchedCount: 1,
        skippedCount: 0,
        completes: false,
        tracking: {
          status: 'in_progress',
          startedAt: '2026-04-01',
          finishedAt: null,
          rewatches: [],
        },
      },
    ]);
  });

  it('returns only the entries that change', () => {
    const watches = { a: [view('2026-03-01')] };
    const inProgress = {
      status: 'in_progress' as const,
      startedAt: '2026-03-01',
      finishedAt: null,
      rewatches: [],
    };
    expect(
      deriveSeriesTracking({
        seasons: [season(1, ['a', 'b'], { tracking: inProgress, watchedCount: 1 })],
        watches,
        today: TODAY,
      }),
    ).toEqual([]);
  });

  it('with datesOnly moves the dates and the count but never the status', () => {
    const done = {
      status: 'completed' as const,
      startedAt: '2026-01-01',
      finishedAt: '2026-02-01',
      rewatches: [],
    };
    const [update] = deriveSeriesTracking({
      seasons: [season(1, ['a', 'b'], { tracking: done, watchedCount: 2 })],
      watches: { a: [view('2026-03-05')] },
      today: TODAY,
      datesOnly: true,
    });
    expect(update).toMatchObject({
      watchedCount: 1,
      completes: false,
      tracking: { status: 'completed', startedAt: '2026-03-05', finishedAt: '2026-02-01' },
    });
  });

  it('with keepUnrecorded leaves a completed season that records none of its episodes alone', () => {
    const done = { ...planned, status: 'completed' as const };
    const seasons = [season(1, ['a', 'b'], { tracking: done, watchedCount: 2 })];
    expect(
      deriveSeriesTracking({ seasons, watches: { z: [] }, today: TODAY, keepUnrecorded: true }),
    ).toEqual([]);
    expect(deriveSeriesTracking({ seasons, watches: { z: [] }, today: TODAY })[0]).toMatchObject({
      watchedCount: 0,
      skippedCount: 0,
    });
  });

  it('materializes such a season before a change so its other episodes stay watched', () => {
    const done = { ...planned, status: 'completed' as const };
    const seasons = [season(1, ['a', 'b', 'c'], { tracking: done, watchedCount: 3 })];
    expect(materializeCompletedSeasons(seasons, {})).toEqual({ a: [], b: [], c: [] });
    expect(materializeCompletedSeasons(seasons, { a: [view('2026-01-01')] })).toEqual({
      a: [view('2026-01-01')],
    });
  });

  it('counts skipped episodes of each season and completes with them', () => {
    const updates = deriveSeriesTracking({
      seasons: [season(1, ['a', 'b', 'c'])],
      watches: { a: [view('2026-03-01')], c: [view('2026-03-03')] },
      skipped: ['b', 'zzz'],
      today: TODAY,
    });
    expect(updates).toEqual([
      expect.objectContaining({
        seasonId: 1,
        watchedCount: 2,
        skippedCount: 1,
        completes: true,
        tracking: expect.objectContaining({ status: 'completed', finishedAt: '2026-03-03' }),
      }),
    ]);
  });
});
