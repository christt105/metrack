import { describe, expect, it } from 'vitest';
import {
  applyEpisodeChange,
  applyEpisodeOperation,
  deriveSeasonTracking,
  materializeEpisodeWatches,
  mergeEpisodeWatches,
  sameEpisodeWatches,
  skipBlockers,
  type EpisodeWatches,
  type ExpectedEpisode,
  type SeasonTracking,
  type Viewing,
} from '../src/index.js';

const TODAY = '2026-11-17';

const day = (date: string): Viewing => ({ startedAt: date, finishedAt: date });
const view = (finishedAt: string | null, startedAt: string | null = null): Viewing => ({
  startedAt,
  finishedAt,
});

const planned: SeasonTracking = {
  status: 'planned',
  startedAt: null,
  finishedAt: null,
  rewatches: [],
  abandoned: [],
};
const completed: SeasonTracking = {
  status: 'completed',
  startedAt: '2026-01-01',
  finishedAt: '2026-02-01',
  rewatches: [],
  abandoned: [],
};

function episodes(count: number, airDate: string | null = '2025-01-01'): ExpectedEpisode[] {
  return Array.from({ length: count }, (_, i) => ({ key: String(i + 1), airDate }));
}

function derive(tracking: SeasonTracking, watches: EpisodeWatches, expected = episodes(3)) {
  return deriveSeasonTracking({ tracking, episodes: expected, watches, today: TODAY });
}

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

describe('deriveSeasonTracking', () => {
  it('starts a planned or paused season on the first watched episode, at the earliest date', () => {
    const watches = { '2': [day('2026-03-05')], '1': [view('2026-03-03', '2026-03-02')] };
    expect(derive(planned, watches)).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-03-02',
      completes: false,
    });
    expect(derive({ ...planned, status: 'paused' }, watches).status).toBe('in_progress');
  });

  it('sets nothing from viewings without a date', () => {
    expect(derive(planned, { '1': [] })).toMatchObject({ status: 'in_progress', startedAt: null });
  });

  it('keeps a stored start when no episode has a dated viewing and never changes a dropped season', () => {
    const started = { ...planned, status: 'in_progress' as const, startedAt: '2026-01-01' };
    expect(derive(started, { '1': [] }).startedAt).toBe('2026-01-01');
    expect(derive(started, { '1': [day('2026-03-03')] }).startedAt).toBe('2026-03-03');
    const dropped = { ...planned, status: 'dropped' as const };
    expect(derive(dropped, { '1': [day('2026-03-03')], '2': [], '3': [] })).toMatchObject({
      status: 'dropped',
      startedAt: null,
      completes: false,
    });
  });

  it('completes when every aired episode is watched, on the latest first viewing', () => {
    const watches = {
      '1': [day('2026-03-01'), day('2026-04-01')],
      '2': [day('2026-03-09')],
      '3': [day('2026-03-05')],
    };
    expect(derive(planned, watches)).toMatchObject({
      status: 'completed',
      startedAt: '2026-03-01',
      finishedAt: '2026-03-09',
      completes: true,
    });
  });

  it('completes without dates and never invents a start', () => {
    expect(derive(planned, { '1': [], '2': [], '3': [] })).toMatchObject({
      status: 'completed',
      startedAt: null,
      finishedAt: null,
    });
  });

  it('does not complete while an episode is still to air or unwatched', () => {
    const watches = {
      '1': [day('2026-03-01')],
      '2': [day('2026-03-02')],
      '3': [day('2026-03-03')],
    };
    const later = [...episodes(2), { key: '3', airDate: '2026-12-01' }];
    expect(derive(planned, watches, later).status).toBe('in_progress');
    expect(derive(planned, { '1': [day('2026-03-01')] }).status).toBe('in_progress');
    expect(derive(planned, watches, []).status).toBe('planned');
  });

  it('counts episodes without an air date as aired', () => {
    expect(derive(planned, { '1': [], '2': [], '3': [] }, episodes(3, null)).status).toBe(
      'completed',
    );
  });

  it('waits for every expected episode', () => {
    const keys = (count: number) => Array.from({ length: count }, (_, i) => String(i + 1));
    const watches = materializeEpisodeWatches(keys(24));
    expect(derive(planned, watches, episodes(24)).status).toBe('completed');
    expect(derive(planned, materializeEpisodeWatches(keys(23)), episodes(24)).status).toBe(
      'in_progress',
    );
  });

  it('changes nothing when watches are empty, even for a completed season', () => {
    expect(derive(completed, {})).toEqual({ ...completed, completes: false });
    expect(derive(planned, {})).toEqual({ ...planned, completes: false });
  });

  it('opens a rewatch when a completed season gets a viewing after its last finish', () => {
    const watches = {
      '1': [day('2026-01-10'), day('2026-06-01')],
      '2': [day('2026-01-11')],
      '3': [day('2026-01-12')],
    };
    expect(derive(completed, watches)).toMatchObject({
      status: 'completed',
      startedAt: '2026-01-10',
      finishedAt: '2026-01-12',
      rewatches: [{ startedAt: '2026-06-01', finishedAt: null }],
    });
  });

  it('ignores viewings on or before the last finish, closed rewatches included', () => {
    const watches = {
      '1': [day('2026-02-01')],
      '2': [day('2026-01-11')],
      '3': [day('2026-03-05')],
    };
    const tracking = { ...completed, rewatches: [view('2026-03-05', '2026-03-01')] };
    expect(derive(tracking, watches).rewatches).toEqual(tracking.rewatches);
  });

  it('closes the open rewatch on the latest date once every aired episode has a viewing since its start', () => {
    const tracking = { ...completed, rewatches: [{ startedAt: '2026-06-01', finishedAt: null }] };
    const partial = {
      '1': [day('2026-06-01')],
      '2': [day('2026-06-02')],
      '3': [day('2026-01-01')],
    };
    expect(derive(tracking, partial).rewatches).toEqual(tracking.rewatches);
    const whole = { ...partial, '3': [day('2026-01-01'), day('2026-06-04')] };
    expect(derive(tracking, whole).rewatches).toEqual([view('2026-06-04', '2026-06-01')]);
  });

  it('opens and closes a rewatch in one go when the season is watched again entirely', () => {
    const watches = {
      '1': [day('2026-01-10'), day('2026-06-01')],
      '2': [day('2026-01-11'), day('2026-06-02')],
      '3': [day('2026-01-12'), day('2026-06-03')],
    };
    expect(derive(completed, watches).rewatches).toEqual([view('2026-06-03', '2026-06-01')]);
  });

  it('opens a second rewatch after a closed one and keeps at most one open, last', () => {
    const tracking = { ...completed, rewatches: [view('2026-03-05', '2026-03-01')] };
    const watches = { '1': [day('2026-08-01')], '2': [], '3': [] };
    const { rewatches } = derive(tracking, watches);
    expect(rewatches).toEqual([
      view('2026-03-05', '2026-03-01'),
      { startedAt: '2026-08-01', finishedAt: null },
    ]);
  });

  it('opens nothing for a completed season without a finish date', () => {
    const tracking = { ...completed, finishedAt: null };
    expect(derive(tracking, { '1': [day('2026-06-01')], '2': [], '3': [] }).rewatches).toEqual([]);
  });

  it('only waits for aired episodes to close a rewatch', () => {
    const tracking = { ...completed, rewatches: [{ startedAt: '2026-06-01', finishedAt: null }] };
    const expected = [...episodes(2), { key: '3', airDate: '2026-12-31' }];
    const watches = { '1': [day('2026-06-01')], '2': [day('2026-06-02')], '3': [] };
    expect(derive(tracking, watches, expected).rewatches).toEqual([
      view('2026-06-02', '2026-06-01'),
    ]);
  });

  it('opens no rewatch from viewings that were already stored', () => {
    const watches = { '1': [day('2026-01-10'), day('2026-06-01')], '2': [], '3': [] };
    expect(derive(completed, watches).rewatches).toHaveLength(1);
    const known = deriveSeasonTracking({
      tracking: completed,
      episodes: episodes(3),
      watches,
      baseline: watches,
      today: TODAY,
    });
    expect(known.rewatches).toEqual([]);
    const added = deriveSeasonTracking({
      tracking: completed,
      episodes: episodes(3),
      watches: { ...watches, '2': [day('2026-07-01')] },
      baseline: watches,
      today: TODAY,
    });
    expect(added.rewatches).toEqual([{ startedAt: '2026-07-01', finishedAt: null }]);
  });
});

describe('skipped episodes', () => {
  const deriveSkipping = (
    tracking: SeasonTracking,
    watches: EpisodeWatches,
    skipped: string[],
    expected = episodes(3),
  ) =>
    deriveSeasonTracking({
      tracking,
      episodes: expected,
      watches,
      skipped: new Set(skipped),
      today: TODAY,
    });

  it('completes a season when every aired episode is watched or skipped', () => {
    const result = deriveSkipping(planned, { '1': [day('2026-03-01')], '3': [day('2026-03-04')] }, [
      '2',
    ]);
    expect(result).toMatchObject({
      status: 'completed',
      completes: true,
      finishedAt: '2026-03-04',
    });
  });

  it('does not complete while an episode is neither watched nor skipped', () => {
    const result = deriveSkipping(planned, { '1': [day('2026-03-01')] }, ['2']);
    expect(result.status).toBe('in_progress');
  });

  it('still waits for an unaired episode that is not skipped, but not for a skipped one', () => {
    const expected = [...episodes(2), { key: '3', airDate: '2027-01-01' }];
    expect(
      deriveSkipping(planned, { '1': [day('2026-03-01')], '2': [day('2026-03-02')] }, [], expected)
        .status,
    ).toBe('in_progress');
    expect(
      deriveSkipping(
        planned,
        { '1': [day('2026-03-01')], '2': [day('2026-03-02')] },
        ['3'],
        expected,
      ).status,
    ).toBe('completed');
  });

  it('closes a rewatch when every aired episode that is not skipped has a viewing since it started', () => {
    const watches: EpisodeWatches = {
      '1': [day('2026-01-01'), day('2026-05-02')],
      '2': [day('2026-01-02')],
      '3': [day('2026-01-03'), day('2026-05-03')],
    };
    const baseline: EpisodeWatches = {
      '1': [day('2026-01-01')],
      '2': [day('2026-01-02')],
      '3': [day('2026-01-03')],
    };
    const result = deriveSeasonTracking({
      tracking: completed,
      episodes: episodes(3),
      watches,
      baseline,
      skipped: new Set(['2']),
      today: TODAY,
    });
    expect(result.rewatches).toEqual([view('2026-05-03', '2026-05-02')]);
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
