import { describe, expect, it } from 'vitest';
import {
  brokenViewingRule,
  removePass,
  undoRestart,
  type EpisodeWatches,
  type ExpectedEpisode,
  type Viewing,
} from '../src/index.js';

const day = (date: string): Viewing => ({ startedAt: date, finishedAt: date });
const gone = (date: string, on: string): Viewing => ({ ...day(date), abandonedAt: on });
const expected: ExpectedEpisode[] = ['k1', 'k2'].map((key) => ({ key, airDate: '2026-01-01' }));

describe('brokenViewingRule', () => {
  it('accepts valid viewings and open abandoned ones', () => {
    expect(brokenViewingRule([day('2026-01-01'), day('2026-01-02')], '2026-03-05')).toBeNull();
    expect(brokenViewingRule([{ startedAt: null, finishedAt: null }], '2026-03-05')).toBeNull();
  });

  it('names the rule broken', () => {
    expect(
      brokenViewingRule([{ startedAt: '2026-02-02', finishedAt: '2026-02-01' }], '2026-03-05'),
    ).toBe('invalid_dates');
    expect(brokenViewingRule([day('2026-03-07')], '2026-03-05')).toBe('future_date');
    expect(brokenViewingRule([day('2026-03-06')], '2026-03-05')).toBeNull();
    expect(brokenViewingRule([gone('2026-01-01', '2026-03-07')], '2026-03-05')).toBe('future_date');
    expect(brokenViewingRule([day('2026-01-01'), day('2026-01-01')], '2026-03-05')).toBe(
      'duplicate',
    );
  });

  it('lets viewings with no date repeat', () => {
    const unknown = { startedAt: null, finishedAt: null };
    expect(brokenViewingRule([unknown, unknown], '2026-03-05')).toBeNull();
  });

  it('does not take a live viewing and an abandoned one for duplicates', () => {
    expect(
      brokenViewingRule([day('2026-01-01'), gone('2026-01-01', '2026-02-01')], '2026-03-05'),
    ).toBeNull();
  });
});

describe('removePass', () => {
  const watches: EpisodeWatches = {
    k1: [day('2026-01-01'), day('2026-02-01')],
    k2: [day('2026-01-02')],
  };

  it('removes the N-th viewing of each episode that has one', () => {
    expect(removePass(expected, watches, 2)).toEqual({
      ok: true,
      watches: { k1: [day('2026-01-01')], k2: [day('2026-01-02')] },
    });
    expect(removePass(expected, watches, 1)).toEqual({
      ok: true,
      watches: { k1: [day('2026-02-01')] },
    });
  });

  it('does not change its input and refuses a missing pass', () => {
    const copy = JSON.parse(JSON.stringify(watches));
    removePass(expected, watches, 1);
    expect(watches).toEqual(copy);
    expect(removePass(expected, watches, 3)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('keeps abandoned viewings', () => {
    const result = removePass(
      expected,
      { k1: [gone('2026-01-01', '2026-01-05'), day('2026-02-01')] },
      1,
    );
    expect(result).toEqual({ ok: true, watches: { k1: [gone('2026-01-01', '2026-01-05')] } });
  });
});

describe('undoRestart on a given day', () => {
  const watches: EpisodeWatches = {
    k1: [gone('2026-01-01', '2026-01-05'), gone('2026-02-01', '2026-02-05'), day('2026-03-01')],
  };

  it('takes back an earlier day while a later one stands', () => {
    expect(undoRestart(expected, watches, '2026-01-05')).toEqual({
      ok: true,
      watches: { k1: [gone('2026-02-01', '2026-02-05'), day('2026-01-01'), day('2026-03-01')] },
    });
  });

  it('refuses an unknown day and the latest day once something was watched after it', () => {
    expect(undoRestart(expected, watches, '2026-01-06')).toEqual({ ok: false, reason: 'none' });
    expect(undoRestart(expected, watches)).toEqual({ ok: false, reason: 'same_day' });
  });
});
