import { describe, expect, it } from 'vitest';
import type { WatchlistEntry } from '@metrack/domain';
import { buildAgenda } from '../src/logic/following/buildAgenda';
import { addMonths, daysBetween } from '../src/logic/following/dates';
import { followingEvents } from '../src/logic/following/followingEvents';
import { monthGrid } from '../src/logic/following/monthGrid';

function series(id: number, airDate: string | null): WatchlistEntry {
  return {
    type: 'series',
    id,
    title: `Series ${id}`,
    cover: null,
    banner: null,
    releaseDate: '2020-01-01',
    nextEpisode: airDate ? { seasonNumber: 2, episodeNumber: 3, airDate, name: null } : null,
  };
}

function movie(id: number, releaseDate: string | null): WatchlistEntry {
  return {
    type: 'movie',
    id,
    title: `Movie ${id}`,
    cover: null,
    banner: null,
    releaseDate,
    nextEpisode: null,
  };
}

describe('followingEvents', () => {
  it('dates a series by its next episode and a movie by its premiere, oldest first', () => {
    const events = followingEvents([
      series(1, '2026-12-01'),
      movie(2, '2026-11-20'),
      movie(3, null),
    ]);
    expect(events.map((e) => e.key)).toEqual(['movie-2', 'series-1']);
  });

  it('falls back to the newest season date of a series without a next episode', () => {
    expect(followingEvents([series(1, null)]).map((e) => e.date)).toEqual(['2020-01-01']);
  });
});

describe('buildAgenda', () => {
  const today = '2026-11-16';

  it('groups by recent, today, tomorrow, week and month', () => {
    const events = followingEvents([
      movie(1, '2026-11-01'),
      movie(2, '2026-11-12'),
      movie(3, '2026-11-16'),
      movie(4, '2026-11-17'),
      movie(5, '2026-11-20'),
      movie(6, '2026-11-23'),
      movie(7, '2026-12-25'),
      movie(8, '2027-01-02'),
    ]);
    const groups = buildAgenda(events, today);
    expect(groups.map((g) => [g.kind, g.month, g.events.map((e) => e.entry.id)])).toEqual([
      ['recent', null, [2]],
      ['today', null, [3]],
      ['tomorrow', null, [4]],
      ['week', null, [5]],
      ['month', '2026-11', [6]],
      ['month', '2026-12', [7]],
      ['month', '2027-01', [8]],
    ]);
  });
});

describe('dates', () => {
  it('counts days and moves months across years', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('monthGrid', () => {
  it('starts on Monday and fills whole weeks', () => {
    const weeks = monthGrid('2026-11');
    expect(weeks[0]?.[0]).toEqual({ date: '2026-10-26', day: 26, inMonth: false });
    expect(weeks[0]?.[6]).toEqual({ date: '2026-11-01', day: 1, inMonth: true });
    expect(weeks.at(-1)?.[0]).toEqual({ date: '2026-11-30', day: 30, inMonth: true });
    expect(weeks.at(-1)?.[6]).toEqual({ date: '2026-12-06', day: 6, inMonth: false });
    expect(weeks).toHaveLength(6);
  });

  it('stops at the week that holds the last day', () => {
    const weeks = monthGrid('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]?.date).toBe('2027-02-01');
  });
});
