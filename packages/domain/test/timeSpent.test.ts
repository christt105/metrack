import { describe, expect, it } from 'vitest';
import {
  averageRuntime,
  manualTimeSpent,
  movieTimeSpent,
  seasonTimeSpent,
  sumTimeSpent,
  tallyTimeSpent,
  type SeasonTimeInput,
} from '../src/index.js';

const closed = (date: string) => ({ startedAt: null, finishedAt: date });

describe('movieTimeSpent', () => {
  const base = {
    runtime: 120,
    status: 'completed' as const,
    finishedAt: '2025-03-05',
    rewatches: [],
  };

  it('counts the runtime once for a first viewing', () => {
    expect(movieTimeSpent(base)).toEqual({ minutes: 120, byYear: { '2025': 120 } });
  });

  it('adds each finished rewatch in its own year and ignores open ones', () => {
    const spent = movieTimeSpent({
      ...base,
      rewatches: [
        closed('2026-01-01'),
        closed('2026-02-01'),
        { startedAt: '2026-03-01', finishedAt: null },
      ],
    });
    expect(spent).toEqual({ minutes: 360, byYear: { '2025': 120, '2026': 240 } });
  });

  it('keeps an undated first viewing in the total only', () => {
    expect(movieTimeSpent({ ...base, finishedAt: null })).toEqual({ minutes: 120, byYear: {} });
  });

  it('has no data without a runtime, with a zero runtime or when not completed', () => {
    expect(movieTimeSpent({ ...base, runtime: null })).toBeNull();
    expect(movieTimeSpent({ ...base, runtime: 0 })).toBeNull();
    expect(movieTimeSpent({ ...base, status: 'in_progress' })).toBeNull();
    expect(movieTimeSpent({ ...base, status: 'planned' })).toBeNull();
  });
});

describe('manualTimeSpent', () => {
  it('places the minutes in the finish year and treats null as no data', () => {
    expect(manualTimeSpent({ timeSpentMinutes: 90, finishedAt: '2026-04-01' })).toEqual({
      minutes: 90,
      byYear: { '2026': 90 },
    });
    expect(manualTimeSpent({ timeSpentMinutes: 90, finishedAt: null })).toEqual({
      minutes: 90,
      byYear: {},
    });
    expect(manualTimeSpent({ timeSpentMinutes: null, finishedAt: '2026-04-01' })).toBeNull();
    expect(manualTimeSpent({ timeSpentMinutes: 0, finishedAt: '2026-04-01' })).toBeNull();
  });
});

describe('seasonTimeSpent', () => {
  const episodes = [
    { key: 'a', runtime: 20 },
    { key: 'b', runtime: 40 },
    { key: 'c', runtime: null },
  ];
  const input = (overrides: Partial<SeasonTimeInput>): SeasonTimeInput => ({
    episodes,
    watches: {},
    skipped: new Set(),
    seriesRuntime: null,
    watchedCount: 0,
    finishedAt: null,
    ...overrides,
  });

  it('adds every viewing of every watched episode, rewatches included, by finish year', () => {
    const spent = seasonTimeSpent(
      input({
        watches: { a: [closed('2025-01-01'), closed('2026-01-01')], b: [closed('2025-02-01')] },
      }),
    );
    expect(spent).toEqual({ minutes: 20 + 20 + 40, byYear: { '2025': 60, '2026': 20 } });
  });

  it('counts an episode watched on an unknown date once, in the total only', () => {
    expect(seasonTimeSpent(input({ watches: { a: [] } }))).toEqual({ minutes: 20, byYear: {} });
  });

  it('gives an episode without runtime the season average, then the series runtime', () => {
    expect(seasonTimeSpent(input({ watches: { c: [] } }))?.minutes).toBe(30);
    expect(
      seasonTimeSpent(
        input({ episodes: [{ key: 'c', runtime: null }], watches: { c: [] }, seriesRuntime: 45 }),
      )?.minutes,
    ).toBe(45);
    expect(
      seasonTimeSpent(input({ episodes: [{ key: 'c', runtime: null }], watches: { c: [] } })),
    ).toBeNull();
  });

  it('leaves out skipped episodes and keys that are not in the catalog', () => {
    const spent = seasonTimeSpent(
      input({ watches: { a: [], b: [], zzz: [] }, skipped: new Set(['b']) }),
    );
    expect(spent?.minutes).toBe(20);
  });

  it('counts a completed season that stores no watches by its watched count', () => {
    expect(seasonTimeSpent(input({ watchedCount: 3, finishedAt: '2024-05-01' }))).toEqual({
      minutes: 90,
      byYear: { '2024': 90 },
    });
  });

  it('uses the series runtime for a season without a catalog and has no data without one', () => {
    const bare = { episodes: null, watchedCount: 4, finishedAt: '2023-01-01' };
    expect(seasonTimeSpent(input({ ...bare, seriesRuntime: 25 }))).toEqual({
      minutes: 100,
      byYear: { '2023': 100 },
    });
    expect(seasonTimeSpent(input(bare))).toBeNull();
    expect(seasonTimeSpent(input({ ...bare, watchedCount: 0, seriesRuntime: 25 }))).toBeNull();
  });

  it('has no data when nothing was watched', () => {
    expect(seasonTimeSpent(input({}))).toBeNull();
  });
});

describe('helpers', () => {
  it('averages only known runtimes', () => {
    expect(
      averageRuntime([
        { key: 'a', runtime: 20 },
        { key: 'b', runtime: 25 },
        { key: 'c', runtime: null },
      ]),
    ).toBe(23);
    expect(
      averageRuntime([
        { key: 'a', runtime: null },
        { key: 'b', runtime: 0 },
      ]),
    ).toBeNull();
  });

  it('tallies and sums, ignoring empty parts', () => {
    expect(tallyTimeSpent([])).toBeNull();
    expect(tallyTimeSpent([{ year: '2026', minutes: 0 }])).toBeNull();
    expect(
      sumTimeSpent([
        { minutes: 10, byYear: { '2025': 10 } },
        null,
        { minutes: 5, byYear: { '2025': 2 } },
      ]),
    ).toEqual({ minutes: 15, byYear: { '2025': 12 } });
    expect(sumTimeSpent([null, null])).toBeNull();
  });
});
