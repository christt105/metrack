import { describe, expect, it } from 'vitest';
import {
  abandonedPassCount,
  currentPassStart,
  deriveSeasonTracking,
  deriveSeriesTracking,
  passWatches,
  restartSeason,
  undoRestart,
  type EpisodeWatches,
  type ExpectedEpisode,
  type SeasonEpisodeItem,
  type SeasonTracking,
  type Viewing,
} from '../src/index.js';

const day = (date: string): Viewing => ({ startedAt: date, finishedAt: date });
const episodes = (count: number): ExpectedEpisode[] =>
  Array.from({ length: count }, (_, i) => ({ key: String(i + 1), airDate: '2025-01-01' }));
const inProgress: SeasonTracking = {
  status: 'in_progress',
  startedAt: '2026-01-01',
  finishedAt: null,
  rewatches: [],
  abandoned: [],
};
const firstPass: EpisodeWatches = {
  '1': [day('2026-01-01')],
  '2': [day('2026-01-02')],
  '3': [day('2026-01-03')],
};

function started(tracking: SeasonTracking, watches: EpisodeWatches, today: string) {
  const result = restartSeason(tracking, episodes(10), watches, today);
  if (!result.ok) throw new Error(result.reason);
  return result.tracking;
}

function items(watches: EpisodeWatches, skipped: string[] = []): SeasonEpisodeItem[] {
  return episodes(10).map(
    ({ key }) =>
      ({
        key,
        skipped: skipped.includes(key),
        viewings: watches[key] ?? [],
      }) as SeasonEpisodeItem,
  );
}

describe('restartSeason', () => {
  it('keeps the pass and clears the dates', () => {
    expect(started(inProgress, firstPass, '2026-02-01')).toEqual({
      status: 'in_progress',
      startedAt: null,
      finishedAt: null,
      rewatches: [],
      abandoned: [{ startedAt: '2026-01-01', finishedAt: '2026-01-03', restartedOn: '2026-02-01' }],
    });
  });

  it('refuses a season that is not in progress, has nothing watched, or was watched today', () => {
    expect(
      restartSeason({ ...inProgress, status: 'paused' }, episodes(10), firstPass, '2026-02-01'),
    ).toEqual({
      ok: false,
      reason: 'not_in_progress',
    });
    expect(restartSeason(inProgress, episodes(10), {}, '2026-02-01')).toEqual({
      ok: false,
      reason: 'nothing_watched',
    });
    expect(restartSeason(inProgress, episodes(10), firstPass, '2026-01-03')).toEqual({
      ok: false,
      reason: 'same_day',
    });
  });

  it('needs a viewing in the current pass to start over again', () => {
    const tracking = started(inProgress, firstPass, '2026-02-01');
    expect(restartSeason(tracking, episodes(10), firstPass, '2026-03-01')).toEqual({
      ok: false,
      reason: 'nothing_watched',
    });
  });
});

describe('a season started over', () => {
  it('reads 3 of 10, then completes with the real date of the last episode and no rewatch', () => {
    const tracking = started(inProgress, firstPass, '2026-02-01');
    let watches = { ...firstPass };
    const mark = (keys: string[], date: string) => {
      for (const key of keys) watches = { ...watches, [key]: [...(watches[key] ?? []), day(date)] };
      return deriveSeasonTracking({
        tracking: current,
        episodes: episodes(10),
        watches,
        today: '2026-03-01',
      });
    };
    let current = tracking;
    const reset = deriveSeasonTracking({
      tracking,
      episodes: episodes(10),
      watches,
      today: '2026-02-01',
    });
    expect(reset).toMatchObject({ status: 'in_progress', startedAt: null, finishedAt: null });
    current = reset;
    let derived = mark(['1', '2', '3'], '2026-02-01');
    expect(derived).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-02-01',
      completes: false,
    });
    current = derived;
    derived = mark(['4', '5', '6', '7', '8', '9', '10'], '2026-02-05');
    expect(derived).toMatchObject({
      status: 'completed',
      startedAt: '2026-02-01',
      finishedAt: '2026-02-05',
      completes: true,
      rewatches: [],
    });
    expect(watches['1']).toHaveLength(2);
    expect(watches['4']).toHaveLength(1);
    expect(abandonedPassCount(derived.abandoned, 0, items(watches))).toEqual({
      watched: 3,
      total: 10,
    });
  });

  it('keeps the episodes counted by the new pass only', () => {
    const tracking = started(inProgress, firstPass, '2026-02-01');
    const watches = { ...firstPass, '1': [...firstPass['1']!, day('2026-02-02')] };
    const updates = deriveSeriesTracking({
      seasons: [
        { seasonId: 1, tracking, watchedCount: 3, skippedCount: 0, episodes: episodes(10) },
      ],
      watches,
      today: '2026-02-02',
    });
    expect(updates[0]?.watchedCount).toBe(1);
  });

  it('leaves skipped filler skipped and does not owe it', () => {
    const tracking = started(inProgress, firstPass, '2026-02-01');
    const skipped = new Set(['5', '6']);
    const watches: EpisodeWatches = {
      ...firstPass,
      '1': [...firstPass['1']!, day('2026-02-02')],
      '2': [...firstPass['2']!, day('2026-02-02')],
      '3': [...firstPass['3']!, day('2026-02-02')],
      '4': [day('2026-02-03')],
      '7': [day('2026-02-03')],
      '8': [day('2026-02-03')],
      '9': [day('2026-02-03')],
      '10': [day('2026-02-04')],
    };
    const derived = deriveSeasonTracking({
      tracking,
      episodes: episodes(10),
      watches,
      skipped,
      today: '2026-02-04',
    });
    expect(derived).toMatchObject({ status: 'completed', finishedAt: '2026-02-04' });
    expect([...skipped]).toEqual(['5', '6']);
    expect(abandonedPassCount(derived.abandoned, 0, items(watches, ['5', '6']))).toEqual({
      watched: 3,
      total: 8,
    });
  });

  it('keeps two abandoned passes apart', () => {
    const second = started(inProgress, firstPass, '2026-02-01');
    const watches: EpisodeWatches = {
      '1': [day('2026-01-01'), day('2026-02-02')],
      '2': [day('2026-01-02'), day('2026-02-03')],
      '3': [day('2026-01-03')],
      '4': [day('2026-02-04')],
      '5': [day('2026-02-05')],
    };
    const mid = deriveSeasonTracking({
      tracking: second,
      episodes: episodes(10),
      watches,
      today: '2026-02-10',
    });
    expect(mid).toMatchObject({ status: 'in_progress', startedAt: '2026-02-02' });
    const third = started(mid, watches, '2026-02-10');
    expect(third.abandoned).toEqual([
      { startedAt: '2026-01-01', finishedAt: '2026-01-03', restartedOn: '2026-02-01' },
      { startedAt: '2026-02-02', finishedAt: '2026-02-05', restartedOn: '2026-02-10' },
    ]);
    expect(currentPassStart(third)).toBe('2026-02-10');
    const all = items(watches);
    expect(abandonedPassCount(third.abandoned, 0, all)).toEqual({ watched: 3, total: 10 });
    expect(abandonedPassCount(third.abandoned, 1, all)).toEqual({ watched: 4, total: 10 });
    expect(passWatches(watches, '2026-02-10')).toEqual({});
  });

  it('prefers the open rewatch for the start of the pass', () => {
    const tracking = {
      ...started(inProgress, firstPass, '2026-02-01'),
      rewatches: [{ startedAt: '2026-05-01', finishedAt: null }],
    };
    expect(currentPassStart(tracking)).toBe('2026-05-01');
  });
});

describe('undoRestart', () => {
  it('removes the last pass and derives the season again', () => {
    const tracking = started(inProgress, firstPass, '2026-02-01');
    const undone = undoRestart(tracking);
    expect(undone).toEqual(inProgress);
    expect(
      deriveSeasonTracking({
        tracking: undone!,
        episodes: episodes(10),
        watches: firstPass,
        today: '2026-02-02',
      }),
    ).toMatchObject({ status: 'in_progress', startedAt: '2026-01-01', abandoned: [] });
    expect(undoRestart(inProgress)).toBeNull();
  });
});
