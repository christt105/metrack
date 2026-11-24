import { describe, expect, it } from 'vitest';
import {
  abandonedPasses,
  applyEpisodeChange,
  computeSeasonTracking,
  liveWatches,
  mergeEpisodeWatches,
  normalizeEpisodeWatches,
  normalizeViewings,
  readViewings,
  restartSeason,
  undoRestart,
  type EpisodeState,
  type EpisodeWatches,
  type ExpectedEpisode,
  type SeasonTracking,
  type Viewing,
} from '../src/index.js';

const TODAY = '2026-11-23';
const day = (date: string): Viewing => ({ startedAt: date, finishedAt: date });
const gone = (date: string, on: string): Viewing => ({
  startedAt: date,
  finishedAt: date,
  abandonedAt: on,
});

const planned: SeasonTracking = {
  status: 'planned',
  startedAt: null,
  finishedAt: null,
  rewatches: [],
  wantsRewatch: false,
};

const expected: ExpectedEpisode[] = ['k1', 'k2', 'k3'].map((key) => ({
  key,
  airDate: '2026-01-01',
}));

function compute(tracking: SeasonTracking, watches: EpisodeWatches, today = TODAY) {
  return computeSeasonTracking({ tracking, episodes: expected, watches, today });
}

function restart(watches: EpisodeWatches, today = TODAY) {
  const result = restartSeason(expected, watches, new Set(), today, false);
  if (!result.ok) throw new Error(result.reason);
  return result.watches;
}

function mark(state: EpisodeState, keys: string[], date: string): EpisodeState {
  return applyEpisodeChange(state, { op: 'mark', keys, date });
}

describe('abandoned viewings', () => {
  it('are kept, sorted first and told apart from live ones when normalizing', () => {
    const list = normalizeViewings([
      day('2026-05-01'),
      gone('2026-03-01', '2026-04-01'),
      gone('2026-03-01', '2026-04-01'),
      { startedAt: null, finishedAt: null },
      { startedAt: null, finishedAt: null, abandonedAt: '2026-04-01' },
    ]);
    expect(list).toEqual([
      { startedAt: null, finishedAt: null, abandonedAt: '2026-04-01' },
      gone('2026-03-01', '2026-04-01'),
      { startedAt: null, finishedAt: null },
      day('2026-05-01'),
    ]);
  });

  it('round trip through the stored and the wire form', () => {
    const watches = { '1001': [gone('2026-03-01', '2026-04-01'), day('2026-05-01')], s1e2: [] };
    const read = normalizeEpisodeWatches(JSON.parse(JSON.stringify(watches)));
    expect(read).toEqual(watches);
    expect(readViewings([{ startedAt: null, finishedAt: '2026-01-01', abandonedAt: 5 }])).toEqual([
      { startedAt: null, finishedAt: '2026-01-01' },
    ]);
  });

  it('leave only the live viewings in liveWatches', () => {
    expect(
      liveWatches({ k1: [gone('2026-03-01', '2026-04-01')], k2: [], k3: [day('2026-05-01')] }),
    ).toEqual({ k2: [], k3: [day('2026-05-01')] });
  });
});

describe('restartSeason', () => {
  it('marks the viewings of the pass in progress abandoned with today', () => {
    const watches = restart({ k1: [day('2026-03-01')], k2: [day('2026-03-02')] });
    expect(watches).toEqual({
      k1: [gone('2026-03-01', TODAY)],
      k2: [gone('2026-03-02', TODAY)],
    });
  });

  it('abandons an episode watched on an unknown date', () => {
    expect(restart({ k1: [], k2: [day('2026-03-02')] }).k1).toEqual([
      { startedAt: null, finishedAt: null, abandonedAt: TODAY },
    ]);
  });

  it('abandons only the open rewatch pass of a completed season', () => {
    const watches = restart({
      k1: [day('2026-01-01'), day('2026-06-01')],
      k2: [day('2026-01-02'), day('2026-06-02')],
      k3: [day('2026-01-03')],
    });
    expect(watches.k1).toEqual([gone('2026-06-01', TODAY), day('2026-01-01')]);
    expect(watches.k3).toEqual([day('2026-01-03')]);
  });

  it('is refused for a dropped season, a finished one and one with nothing watched', () => {
    expect(restartSeason(expected, { k1: [day('2026-03-01')] }, new Set(), TODAY, true)).toEqual({
      ok: false,
      reason: 'not_in_progress',
    });
    const done = { k1: [day('2026-01-01')], k2: [day('2026-01-02')], k3: [day('2026-01-03')] };
    expect(restartSeason(expected, done, new Set(), TODAY, false)).toEqual({
      ok: false,
      reason: 'not_in_progress',
    });
    expect(restartSeason(expected, {}, new Set(), TODAY, false)).toEqual({
      ok: false,
      reason: 'nothing_watched',
    });
  });

  it('is refused a second time on the same day', () => {
    const watches = restart({ k1: [day('2026-03-01')] });
    const again = mark({ watches, skipped: [] }, ['k1'], TODAY).watches;
    expect(restartSeason(expected, again, new Set(), TODAY, false)).toEqual({
      ok: false,
      reason: 'same_day',
    });
    expect(restartSeason(expected, again, new Set(), '2026-11-24', false).ok).toBe(true);
  });
});

describe('undoRestart', () => {
  it('removes the mark and gives the viewings back', () => {
    const before = { k1: [day('2026-03-01')], k2: [day('2026-03-02')] };
    expect(undoRestart(expected, restart(before))).toEqual({ ok: true, watches: before });
  });

  it('is refused when nothing was started over', () => {
    expect(undoRestart(expected, { k1: [day('2026-03-01')] })).toEqual({
      ok: false,
      reason: 'none',
    });
  });

  it('is refused once a viewing was made on or after the day it was started over', () => {
    const marked = mark(
      { watches: restart({ k1: [day('2026-03-01')] }), skipped: [] },
      ['k1'],
      TODAY,
    );
    expect(undoRestart(expected, marked.watches)).toEqual({ ok: false, reason: 'same_day' });
  });

  it('takes back only the last restart', () => {
    const first = restart({ k1: [day('2026-03-01')] }, '2026-11-20');
    const second = mark({ watches: first, skipped: [] }, ['k1'], '2026-11-21').watches;
    const twice = restart(second, '2026-11-22');
    expect(undoRestart(expected, twice)).toEqual({
      ok: true,
      watches: { k1: [gone('2026-03-01', '2026-11-20'), day('2026-11-21')] },
    });
  });
});

describe('computeSeasonTracking with abandoned viewings', () => {
  it('numbers passes without them: a restarted season is in progress with no dates', () => {
    const result = compute(planned, restart({ k1: [day('2026-03-01')], k2: [day('2026-03-02')] }));
    expect(result.tracking).toMatchObject({
      status: 'in_progress',
      startedAt: null,
      finishedAt: null,
      rewatches: [],
    });
    expect(result.watchedCount).toBe(0);
  });

  it('starts the new pass from its first viewing and completes it without a rewatch', () => {
    let state: EpisodeState = { watches: restart({ k1: [day('2026-03-01')] }), skipped: [] };
    state = mark(state, ['k1', 'k2', 'k3'], '2026-11-24');
    const result = compute(planned, state.watches, '2026-11-24');
    expect(result.tracking).toMatchObject({
      status: 'completed',
      startedAt: '2026-11-24',
      finishedAt: '2026-11-24',
      rewatches: [],
    });
    expect(result.watchedCount).toBe(3);
  });

  it('keeps planned, mark, unmark ending planned with a restart and its undo in between', () => {
    let state: EpisodeState = { watches: {}, skipped: [] };
    state = mark(state, ['k1'], '2026-11-20');
    const started = compute(planned, state.watches);
    expect(started.tracking.status).toBe('in_progress');
    const withManual = { ...started.tracking, manual: planned };
    const restarted = restart(state.watches);
    expect(compute(withManual, restarted).tracking.status).toBe('in_progress');
    const undone = undoRestart(expected, restarted);
    if (!undone.ok) throw new Error(undone.reason);
    const back = applyEpisodeChange(
      { watches: undone.watches, skipped: [] },
      { op: 'unmark', keys: ['k1'] },
    );
    expect(back.watches).toEqual({});
    expect(compute(withManual, back.watches).tracking).toMatchObject({
      status: 'planned',
      startedAt: null,
    });
  });

  it('unmarking an episode in the new pass keeps the abandoned viewing', () => {
    const watches = mark(
      { watches: restart({ k1: [day('2026-03-01')] }), skipped: [] },
      ['k1'],
      TODAY,
    ).watches;
    expect(watches.k1).toEqual([gone('2026-03-01', TODAY), day(TODAY)]);
    const unmarked = applyEpisodeChange({ watches, skipped: [] }, { op: 'unmark', keys: ['k1'] });
    expect(unmarked.watches.k1).toEqual([gone('2026-03-01', TODAY)]);
    const again = applyEpisodeChange(unmarked, { op: 'unmark', keys: ['k1'] });
    expect(again.watches.k1).toEqual([gone('2026-03-01', TODAY)]);
  });

  it('opens a rewatch when E1 and E2 are watched in pass 2 or later, and not for abandoned ones', () => {
    const completed: SeasonTracking = {
      ...planned,
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-01-03',
    };
    const first = { k1: [day('2026-01-01')], k2: [day('2026-01-02')], k3: [day('2026-01-03')] };
    const second = {
      k1: [...first.k1, day('2026-06-01')],
      k2: [...first.k2, day('2026-06-02')],
      k3: first.k3,
    };
    expect(compute(completed, second).tracking.rewatches).toEqual([
      { startedAt: '2026-06-01', finishedAt: null },
    ]);
    const abandoned = restart(second);
    const after = compute(completed, abandoned).tracking;
    expect(after.status).toBe('completed');
    expect(after.rewatches).toEqual([]);
    const again = mark({ watches: abandoned, skipped: [] }, ['k1', 'k2'], '2026-11-24').watches;
    expect(compute(completed, again, '2026-11-24').tracking.rewatches).toEqual([
      { startedAt: '2026-11-24', finishedAt: null },
    ]);
  });

  it('does not count an episode that only has abandoned viewings as watched', () => {
    const watches = restart({ k1: [day('2026-03-01')], k2: [day('2026-03-02')] });
    const state = mark({ watches, skipped: [] }, ['k1', 'k2'], TODAY);
    expect(compute(planned, state.watches).tracking.status).toBe('in_progress');
  });
});

describe('merging plays into abandoned viewings', () => {
  it('does not add a play that already exists as an abandoned viewing', () => {
    const stored = restart({ k1: [day('2026-03-01')] });
    expect(mergeEpisodeWatches(stored, { k1: [day('2026-03-01')] })).toEqual(stored);
  });

  it('counts a later play in the new pass', () => {
    const stored = restart({ k1: [day('2026-03-01')] });
    const merged = mergeEpisodeWatches(stored, { k1: [day('2026-11-25')] });
    expect(merged.k1).toEqual([gone('2026-03-01', TODAY), day('2026-11-25')]);
  });

  it('adds the same date again when it is marked by hand', () => {
    const stored = restart({ k1: [day(TODAY)] });
    const marked = mark({ watches: stored, skipped: [] }, ['k1'], TODAY).watches;
    expect(marked.k1).toEqual([gone(TODAY, TODAY), day(TODAY)]);
  });
});

describe('abandonedPasses', () => {
  it('groups the abandoned viewings by the day they were abandoned', () => {
    const episodes = [
      {
        skipped: false,
        viewings: [gone('2026-03-01', '2026-04-01'), gone('2026-05-01', '2026-06-01')],
      },
      { skipped: false, viewings: [gone('2026-03-05', '2026-04-01')] },
      { skipped: false, viewings: [day('2026-07-01')] },
      { skipped: true, viewings: [] },
    ];
    expect(abandonedPasses(episodes)).toEqual([
      {
        startedAt: '2026-03-01',
        finishedAt: '2026-03-05',
        abandonedOn: '2026-04-01',
        watched: 2,
        total: 3,
      },
      {
        startedAt: '2026-05-01',
        finishedAt: '2026-05-01',
        abandonedOn: '2026-06-01',
        watched: 1,
        total: 3,
      },
    ]);
  });
});
