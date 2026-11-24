import { describe, expect, it } from 'vitest';
import type { SeasonEpisodeItem } from '@metrack/domain';
import { changeViewing, deleteViewing } from '../src/logic/historyOperations';
import { seasonHistory } from '../src/logic/seasonHistory';

const day = (date: string, abandonedAt?: string) => ({
  startedAt: date,
  finishedAt: date,
  ...(abandonedAt ? { abandonedAt } : {}),
});
const item = (
  number: number,
  viewings: SeasonEpisodeItem['viewings'],
  patch: Partial<SeasonEpisodeItem> = {},
): SeasonEpisodeItem => ({
  key: `k${number}`,
  number,
  tmdbId: number,
  title: `Title ${number}`,
  airDate: '2020-01-01',
  runtime: null,
  overview: null,
  stillPath: null,
  watched: viewings.some((v) => v.abandonedAt === undefined) || viewings.length === 0,
  skipped: false,
  viewings,
  filler: null,
  ...patch,
});

describe('seasonHistory', () => {
  const episodes = [
    item(1, [day('2026-01-01', '2026-02-01'), day('2026-03-01'), day('2026-04-01')]),
    item(2, [day('2026-03-02')]),
    item(3, []),
    item(4, [], { watched: false }),
    item(5, [], { skipped: true, watched: false }),
  ];

  it('groups the N-th live viewing of each episode and lists the abandoned passes apart', () => {
    const { passes, abandoned } = seasonHistory(episodes);
    expect(passes.map((p) => [p.number, p.rows.map((r) => r.number)])).toEqual([
      [1, [1, 2, 3]],
      [2, [1]],
    ]);
    expect(passes[0]).toMatchObject({ startedAt: '2026-03-01', finishedAt: '2026-03-02' });
    expect(abandoned).toHaveLength(1);
    expect(abandoned[0]).toMatchObject({ abandonedOn: '2026-02-01', startedAt: '2026-01-01' });
  });

  it('lists a watch on an unknown date as one viewing without dates', () => {
    const row = seasonHistory(episodes).passes[0]!.rows[2]!;
    expect(row.viewing).toEqual({ startedAt: null, finishedAt: null });
    expect(row.others).toEqual([]);
  });

  it('keeps the other viewings of an episode on each row', () => {
    const row = seasonHistory(episodes).passes[1]!.rows[0]!;
    expect(row.viewing).toEqual(day('2026-04-01'));
    expect(row.others).toEqual([day('2026-01-01', '2026-02-01'), day('2026-03-01')]);
  });
});

describe('historyOperations', () => {
  const episodes = [item(1, [day('2026-01-01', '2026-02-01'), day('2026-03-01')]), item(2, [])];
  const rows = seasonHistory(episodes).passes[0]!.rows;

  it('changes the dates keeping the others and the abandoned ones', () => {
    expect(changeViewing(rows[0]!, day('2026-03-09'))).toEqual({
      op: 'setViewings',
      key: 'k1',
      viewings: [day('2026-01-01', '2026-02-01'), day('2026-03-09')],
    });
    expect(changeViewing(rows[1]!, day('2026-03-09'))).toEqual({
      op: 'setViewings',
      key: 'k2',
      viewings: [day('2026-03-09')],
    });
  });

  it('unmarks when the viewing was the last live one', () => {
    expect(deleteViewing(rows[0]!)).toEqual({ op: 'unmark', keys: ['k1'] });
    const two = seasonHistory([item(1, [day('2026-01-01'), day('2026-03-01')])]).passes[1]!
      .rows[0]!;
    expect(deleteViewing(two)).toEqual({
      op: 'setViewings',
      key: 'k1',
      viewings: [day('2026-01-01')],
    });
  });
});
