import { describe, expect, it } from 'vitest';
import {
  applyEpisodeChange,
  applyEpisodeOperation,
  materializeEpisodeWatches,
  mergeEpisodeWatches,
  sameEpisodeWatches,
  skipBlockers,
  type EpisodeWatches,
  type Viewing,
} from '../src/index.js';

const day = (date: string): Viewing => ({ startedAt: date, finishedAt: date });
const view = (finishedAt: string | null, startedAt: string | null = null): Viewing => ({
  startedAt,
  finishedAt,
});

describe('mergeEpisodeWatches', () => {
  it('adds viewings and never removes any', () => {
    const stored: EpisodeWatches = { '1': [view('2026-01-01')], '2': [] };
    const merged = mergeEpisodeWatches(stored, {
      '1': [view('2026-03-01')],
      '3': [view('2026-03-02')],
    });
    expect(merged).toEqual({
      '1': [view('2026-01-01'), view('2026-03-01')],
      '2': [],
      '3': [view('2026-03-02')],
    });
    expect(stored['1']).toEqual([view('2026-01-01')]);
  });

  it('treats the same finish date as a duplicate unless both starts differ', () => {
    const stored: EpisodeWatches = { '1': [view('2026-01-02', '2026-01-01')] };
    expect(mergeEpisodeWatches(stored, { '1': [view('2026-01-02')] })).toEqual(stored);
    expect(mergeEpisodeWatches(stored, { '1': [view('2026-01-02', '2026-01-01')] })).toEqual(
      stored,
    );
    expect(
      mergeEpisodeWatches(stored, { '1': [view('2026-01-02', '2026-01-02')] })['1'],
    ).toHaveLength(2);
  });

  it('keeps the unknown date as the first viewing when dated viewings arrive', () => {
    expect(mergeEpisodeWatches({ '1': [] }, { '1': [view('2026-01-01')] })).toEqual({
      '1': [{ startedAt: null, finishedAt: null }, view('2026-01-01')],
    });
  });

  it('marks an episode watched with an empty incoming list', () => {
    expect(mergeEpisodeWatches({}, { '4': [] })).toEqual({ '4': [] });
  });
});

describe('materializeEpisodeWatches and sameEpisodeWatches', () => {
  it('lists every episode as watched on an unknown date', () => {
    expect(materializeEpisodeWatches(['1', '2', '3'])).toEqual({ '1': [], '2': [], '3': [] });
    expect(materializeEpisodeWatches([])).toEqual({});
  });

  it('compares watches regardless of key order', () => {
    expect(sameEpisodeWatches({ '1': [], '2': [] }, { '2': [], '1': [] })).toBe(true);
    expect(sameEpisodeWatches({ '1': [] }, { '1': [view('2026-01-01')] })).toBe(false);
    expect(sameEpisodeWatches({ '1': [] }, { '2': [] })).toBe(false);
  });
});

describe('applyEpisodeOperation', () => {
  it('marks with a date, with an unknown date and as a no-op for watched ones', () => {
    const base: EpisodeWatches = { '1': [view('2026-01-01')] };
    expect(
      applyEpisodeOperation(base, { op: 'mark', keys: ['2', '3'], date: '2026-02-02' }),
    ).toEqual({
      '1': [view('2026-01-01')],
      '2': [view('2026-02-02', '2026-02-02')],
      '3': [view('2026-02-02', '2026-02-02')],
    });
    expect(applyEpisodeOperation(base, { op: 'mark', keys: ['1', '2'], date: null })).toEqual({
      '1': [view('2026-01-01')],
      '2': [],
    });
  });

  it('unmark after mark restores the previous watches', () => {
    const base: EpisodeWatches = { '1': [view('2026-01-01')] };
    const marked = applyEpisodeOperation(base, {
      op: 'mark',
      keys: ['2', '3'],
      date: '2026-02-02',
    });
    expect(applyEpisodeOperation(marked, { op: 'unmark', keys: ['2', '3'] })).toEqual(base);
  });

  it('unmark takes away only the last viewing of an episode watched more than once', () => {
    const base: EpisodeWatches = { '1': [view(null), day('2026-01-01')], '2': [day('2026-01-02')] };
    expect(applyEpisodeOperation(base, { op: 'unmark', keys: ['1', '2'] })).toEqual({
      '1': [],
    });
  });

  it('replaces the viewings of one episode', () => {
    const next = applyEpisodeOperation(
      { '1': [view('2026-01-01')] },
      { op: 'setViewings', key: '1', viewings: [view('2026-05-05'), view('2026-04-04')] },
    );
    expect(next['1']).toEqual([view('2026-04-04'), view('2026-05-05')]);
    expect(applyEpisodeOperation({}, { op: 'setViewings', key: '2', viewings: [] })).toEqual({
      '2': [],
    });
  });
});

describe('applyEpisodeChange', () => {
  it('skips by dropping an undated watch and keeping the skip', () => {
    const next = applyEpisodeChange(
      { watches: { '1': [], '2': [view(null)] }, skipped: [] },
      { op: 'skip', keys: ['1', '2'] },
    );
    expect(next).toEqual({ watches: {}, skipped: ['1', '2'] });
  });

  it('reports the dated viewings that block a skip, and ignores undated ones', () => {
    const watches: EpisodeWatches = { '1': [day('2026-01-01')], '2': [], '3': [view(null)] };
    expect(skipBlockers(watches, ['1', '2', '3', '4'])).toEqual(['1']);
  });

  it('unskips on unskip and on any watch of the episode', () => {
    const state = { watches: {}, skipped: ['1', '2', '3'] };
    expect(applyEpisodeChange(state, { op: 'unskip', keys: ['1'] }).skipped).toEqual(['2', '3']);
    expect(applyEpisodeChange(state, { op: 'mark', keys: ['2'], date: null }).skipped).toEqual([
      '1',
      '3',
    ]);
    expect(
      applyEpisodeChange(state, { op: 'setViewings', key: '3', viewings: [day('2026-01-01')] })
        .skipped,
    ).toEqual(['1', '2']);
  });

  it('leaves the skipped keys alone on unmark', () => {
    const state = { watches: { '1': [] }, skipped: ['2'] };
    expect(applyEpisodeChange(state, { op: 'unmark', keys: ['1'] })).toEqual({
      watches: {},
      skipped: ['2'],
    });
  });
});
