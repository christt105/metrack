import { describe, expect, it } from 'vitest';
import { trackingFromRow, trackingToRow } from '../src/storage/mapping/rowMapping.js';

const row = (rewatches: string) => ({
  status: 'completed',
  started_at: null,
  finished_at: '2026-01-01',
  rating: null,
  review: null,
  rewatches,
  pending_review: 0,
});

describe('tracking rows', () => {
  it('reads the legacy list of finish dates as viewings without a start', () => {
    expect(trackingFromRow(row('["2026-03-01","2026-02-01"]')).rewatches).toEqual([
      { startedAt: null, finishedAt: '2026-02-01' },
      { startedAt: null, finishedAt: '2026-03-01' },
    ]);
  });

  it('writes viewing objects and reads them back unchanged', () => {
    const rewatches = [
      { startedAt: '2026-02-01', finishedAt: '2026-02-03' },
      { startedAt: '2026-04-01', finishedAt: null },
    ];
    const stored = trackingToRow({ ...trackingFromRow(row('[]')), rewatches });
    expect(JSON.parse(String(stored.rewatches))).toEqual(rewatches);
    expect(trackingFromRow(row(String(stored.rewatches))).rewatches).toEqual(rewatches);
  });
});
