import { describe, expect, it } from 'vitest';
import {
  applyEpisodeChange,
  computeSeasonTracking,
  materializeCompletedSeasons,
  type EpisodeState,
  type EpisodeOperation,
  type EpisodeWatches,
  type ExpectedEpisode,
  type SeasonTracking,
  type SeriesSeasonInput,
  type Viewing,
} from '../src/index.js';

const TODAY = '2026-11-23';

const day = (date: string): Viewing => ({ startedAt: date, finishedAt: date });
const undated: Viewing = { startedAt: null, finishedAt: null };

const planned: SeasonTracking = {
  status: 'planned',
  startedAt: null,
  finishedAt: null,
  rewatches: [],
  wantsRewatch: false,
};
const completedByHand: SeasonTracking = {
  status: 'completed',
  startedAt: '2026-11-18',
  finishedAt: '2026-11-18',
  rewatches: [],
  wantsRewatch: false,
};

function episodes(count: number, airDate: string | null = '2026-01-01'): ExpectedEpisode[] {
  return Array.from({ length: count }, (_, i) => ({ key: `k${i + 1}`, airDate }));
}

function compute(
  tracking: SeasonTracking,
  watches: EpisodeWatches,
  options: { count?: number; skipped?: string[]; airDate?: string | null } = {},
) {
  return computeSeasonTracking({
    tracking,
    episodes: episodes(
      options.count ?? 3,
      options.airDate === undefined ? '2026-01-01' : options.airDate,
    ),
    watches,
    skipped: new Set(options.skipped ?? []),
    today: TODAY,
  });
}

describe('computeSeasonTracking first pass', () => {
  it('starts a planned or paused season on the first viewing, at the earliest date', () => {
    const watches = { k2: [day('2026-03-05')], k1: [day('2026-03-02')] };
    for (const status of ['planned', 'paused'] as const) {
      const result = compute({ ...planned, status }, watches);
      expect(result.tracking).toMatchObject({
        status: 'in_progress',
        startedAt: '2026-03-02',
        finishedAt: null,
      });
      expect(result.watchedCount).toBe(2);
      expect(result.completes).toBe(false);
    }
  });

  it('completes when every episode has a viewing, finishing on the latest first viewing', () => {
    const result = compute(planned, {
      k1: [day('2026-03-02')],
      k2: [day('2026-03-09')],
      k3: [day('2026-03-05'), day('2026-09-01')],
    });
    expect(result.tracking).toMatchObject({
      status: 'completed',
      startedAt: '2026-03-02',
      finishedAt: '2026-03-09',
    });
    expect(result.completes).toBe(true);
  });

  it('keeps the stored dates while viewings have no date and never invents any', () => {
    const result = compute(completedByHand, { k1: [], k2: [], k3: [] });
    expect(result.tracking).toEqual(completedByHand);
    expect(result.completes).toBe(false);
    expect(compute(planned, { k1: [] }).tracking).toMatchObject({
      status: 'in_progress',
      startedAt: null,
      finishedAt: null,
    });
  });

  it('does not complete while an episode is unwatched or still to air', () => {
    expect(compute(planned, { k1: [day('2026-03-01')] }).tracking.status).toBe('in_progress');
    const unaired = computeSeasonTracking({
      tracking: planned,
      episodes: [...episodes(2), { key: 'k3', airDate: '2026-12-01' }],
      watches: { k1: [day('2026-03-01')], k2: [day('2026-03-02')] },
      today: TODAY,
    });
    expect(unaired.tracking.status).toBe('in_progress');
  });

  it('counts episodes without an air date as aired', () => {
    const result = compute(
      planned,
      { k1: [day('2026-03-01')], k2: [day('2026-03-02')], k3: [day('2026-03-03')] },
      { airDate: null },
    );
    expect(result.tracking.status).toBe('completed');
  });

  it('completes with skipped episodes and counts them', () => {
    const result = compute(
      planned,
      { k1: [day('2026-03-01')], k3: [day('2026-03-03')] },
      { skipped: ['k2'] },
    );
    expect(result.tracking).toMatchObject({ status: 'completed', finishedAt: '2026-03-03' });
    expect(result.skippedCount).toBe(1);
    expect(result.watchedCount).toBe(2);
  });

  it('returns a completed season to in progress when an episode loses its viewing', () => {
    const result = compute(
      { ...planned, status: 'completed', startedAt: '2026-03-01', finishedAt: '2026-03-03' },
      { k1: [day('2026-03-01')], k2: [day('2026-03-02')] },
    );
    expect(result.tracking.status).toBe('in_progress');
  });

  it('never leaves the start after the finish', () => {
    const result = compute(
      { ...planned, status: 'completed', startedAt: '2026-01-01', finishedAt: '2026-02-02' },
      { k1: [day('2026-03-05')] },
    );
    expect(result.tracking.startedAt).toBe('2026-03-05');
    expect(result.tracking.finishedAt).toBeNull();
  });

  it('brings a start after the finish of a completed season back to the finish', () => {
    const result = compute(
      { ...completedByHand, startedAt: '2026-11-23' },
      { k1: [undated, day('2026-11-23')], k2: [], k3: [] },
    );
    expect(result.tracking).toMatchObject({
      status: 'completed',
      startedAt: '2026-11-18',
      finishedAt: '2026-11-18',
    });
  });

  it('leaves a season without viewings and a dropped season as the user left them', () => {
    expect(compute(completedByHand, {}).tracking).toEqual(completedByHand);
    const dropped = { ...planned, status: 'dropped' as const };
    expect(compute(dropped, { k1: [day('2026-03-01')] }).tracking).toEqual(dropped);
  });

  it('only counts the viewings of its own episodes', () => {
    expect(compute(planned, { other: [day('2026-03-01')] }).tracking).toEqual(planned);
  });
});

describe('computeSeasonTracking passes', () => {
  const everyEpisodeOnce = {
    k1: [day('2026-03-01')],
    k2: [day('2026-03-02')],
    k3: [day('2026-03-03')],
  };
  const done = compute(planned, everyEpisodeOnce).tracking;

  it('does not open a rewatch from a second viewing of an episode without the intention', () => {
    const result = compute(done, {
      ...everyEpisodeOnce,
      k1: [day('2026-03-01'), day('2026-06-01')],
    });
    expect(result.tracking).toEqual(done);
  });

  it('opens a rewatch from the earliest start of its pass once the intention is set', () => {
    const wanting = { ...done, wantsRewatch: true };
    const result = compute(wanting, {
      ...everyEpisodeOnce,
      k2: [day('2026-03-02'), day('2026-06-02')],
      k1: [day('2026-03-01'), day('2026-06-01')],
    });
    expect(result.tracking.status).toBe('completed');
    expect(result.tracking.rewatches).toEqual([{ startedAt: '2026-06-01', finishedAt: null }]);
    expect(result.tracking.wantsRewatch).toBe(true);
  });

  it('keeps the intention without opening anything while nothing was watched again', () => {
    const wanting = { ...done, wantsRewatch: true };
    expect(compute(wanting, everyEpisodeOnce).tracking).toEqual(wanting);
  });

  it('closes the rewatch on its latest finish and clears the intention when the pass completes', () => {
    const wanting = {
      ...done,
      wantsRewatch: true,
      rewatches: [{ startedAt: '2026-06-01', finishedAt: null }],
    };
    const result = compute(wanting, {
      k1: [day('2026-03-01'), day('2026-06-01')],
      k2: [day('2026-03-02'), day('2026-06-02')],
      k3: [day('2026-03-03'), day('2026-06-05')],
    });
    expect(result.tracking.rewatches).toEqual([
      { startedAt: '2026-06-01', finishedAt: '2026-06-05' },
    ]);
    expect(result.tracking.wantsRewatch).toBe(false);
    expect(result.completes).toBe(false);
  });

  it('counts a complete second pass without the intention, as a closed rewatch', () => {
    const result = compute(done, {
      k1: [day('2026-03-01'), day('2026-06-01')],
      k2: [day('2026-03-02'), day('2026-06-02')],
      k3: [day('2026-03-03'), day('2026-06-05')],
    });
    expect(result.tracking.rewatches).toEqual([
      { startedAt: '2026-06-01', finishedAt: '2026-06-05' },
    ]);
    expect(result.tracking.wantsRewatch).toBe(false);
  });

  it('opens a third pass after a closed second one when the intention is set again', () => {
    const closed = { startedAt: '2026-06-01', finishedAt: '2026-06-05' };
    const wanting = { ...done, rewatches: [closed], wantsRewatch: true };
    const result = compute(wanting, {
      k1: [day('2026-03-01'), day('2026-06-01'), day('2026-08-01')],
      k2: [day('2026-03-02'), day('2026-06-02')],
      k3: [day('2026-03-03'), day('2026-06-05')],
    });
    expect(result.tracking.rewatches).toEqual([
      closed,
      { startedAt: '2026-08-01', finishedAt: null },
    ]);
    expect(result.tracking.wantsRewatch).toBe(true);
  });

  it('opens no rewatch while the first pass is incomplete', () => {
    const wanting = { ...planned, status: 'in_progress' as const, wantsRewatch: true };
    const result = compute(wanting, { k1: [day('2026-03-01'), day('2026-06-01')] });
    expect(result.tracking.rewatches).toEqual([]);
    expect(result.tracking.wantsRewatch).toBe(true);
  });

  it('only waits for aired episodes that are not skipped to close a later pass', () => {
    const wanting = { ...done, wantsRewatch: true };
    const watches = {
      k1: [day('2026-03-01'), day('2026-06-01')],
      k3: [day('2026-03-03'), day('2026-06-03')],
    };
    const result = compute(
      { ...wanting, rewatches: [{ startedAt: '2026-06-01', finishedAt: null }] },
      { ...watches, k2: [day('2026-03-02')] },
      { skipped: ['k2'] },
    );
    expect(result.tracking.rewatches).toEqual([
      { startedAt: '2026-06-01', finishedAt: '2026-06-03' },
    ]);
  });
});

describe('mark and unmark', () => {
  function apply(
    tracking: SeasonTracking,
    state: EpisodeState,
    operations: EpisodeOperation[],
    count = 4,
  ) {
    const season: SeriesSeasonInput = {
      seasonId: 1,
      tracking,
      watchedCount: count,
      skippedCount: 0,
      episodes: episodes(count),
    };
    let current = {
      watches: materializeCompletedSeasons([season], state.watches, new Set(state.skipped)),
      skipped: state.skipped,
    };
    let cache = tracking;
    for (const operation of operations) {
      current = applyEpisodeChange(current, operation);
      cache = computeSeasonTracking({
        tracking: cache,
        episodes: episodes(count),
        watches: current.watches,
        skipped: new Set(current.skipped),
        today: TODAY,
      }).tracking;
    }
    return cache;
  }

  const mark = (key: string, date = TODAY): EpisodeOperation => ({ op: 'mark', keys: [key], date });
  const unmark = (key: string): EpisodeOperation => ({ op: 'unmark', keys: [key] });

  it('turns a season completed by hand into an undated first pass and the new mark into the second', () => {
    const state = { watches: {}, skipped: [] };
    const season: SeriesSeasonInput = {
      seasonId: 1,
      tracking: completedByHand,
      watchedCount: 4,
      skippedCount: 0,
      episodes: episodes(4),
    };
    const base = materializeCompletedSeasons([season], state.watches);
    expect(base).toEqual({ k1: [], k2: [], k3: [], k4: [] });
    const next = applyEpisodeChange({ watches: base, skipped: [] }, mark('k1'));
    expect(next.watches.k1).toEqual([undated, day(TODAY)]);
    expect(apply(completedByHand, state, [mark('k1')])).toEqual(completedByHand);
  });

  it('puts a season completed by hand back as it was after marking and unmarking an episode', () => {
    expect(
      apply(completedByHand, { watches: {}, skipped: [] }, [mark('k1'), unmark('k1')]),
    ).toEqual(completedByHand);
  });

  it('leaves the season as it was after marking and unmarking a new episode, in any order', () => {
    const start = { watches: { k1: [day('2026-03-01')] }, skipped: [] };
    const first = compute(planned, start.watches, { count: 4 }).tracking;
    const orders = [
      [mark('k2'), mark('k3'), unmark('k2'), unmark('k3')],
      [mark('k2'), mark('k3'), unmark('k3'), unmark('k2')],
      [mark('k3'), mark('k2'), unmark('k2'), unmark('k3')],
    ];
    for (const operations of orders) {
      expect(apply(first, start, operations)).toEqual(first);
    }
  });

  it('puts a completed season back after marking and unmarking its last episode', () => {
    const start = {
      watches: { k1: [day('2026-03-01')], k2: [day('2026-03-02')], k3: [day('2026-03-03')] },
      skipped: [],
    };
    const first = compute(planned, start.watches, { count: 4 }).tracking;
    expect(first.status).toBe('in_progress');
    const completed = apply(first, start, [mark('k4', '2026-03-09')]);
    expect(completed).toMatchObject({ status: 'completed', finishedAt: '2026-03-09' });
    expect(apply(first, start, [mark('k4', '2026-03-09'), unmark('k4')])).toEqual(first);
  });

  it('keeps a rewatch that was asked for after marking and unmarking an episode of it', () => {
    const watches = {
      k1: [day('2026-03-01')],
      k2: [day('2026-03-02')],
      k3: [day('2026-03-03')],
      k4: [day('2026-03-04')],
    };
    const first = { ...compute(planned, watches, { count: 4 }).tracking, wantsRewatch: true };
    const rewatching = apply(first, { watches, skipped: [] }, [mark('k1')]);
    expect(rewatching.rewatches).toEqual([{ startedAt: TODAY, finishedAt: null }]);
    expect(apply(first, { watches, skipped: [] }, [mark('k1'), unmark('k1')])).toEqual(first);
  });
});
