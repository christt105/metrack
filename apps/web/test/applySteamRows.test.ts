import type { SteamApplyOutcome } from '@metrack/domain';
import { describe, expect, it, vi } from 'vitest';
import { applySteamRows } from '../src/logic/applySteamRows';

const done = (
  appId: string,
  result: SteamApplyOutcome['result'],
  error?: string,
): SteamApplyOutcome => ({
  appId,
  result,
  ...(error ? { error } : {}),
});

describe('applySteamRows', () => {
  it('sends batches of at most ten and tallies the outcomes', async () => {
    const ids = Array.from({ length: 23 }, (_, i) => String(i + 1));
    const send = vi.fn(async (batch: string[]) => ({
      outcomes: batch.map((id) => done(id, Number(id) % 2 === 0 ? 'updated' : 'imported')),
    }));
    const progress: number[] = [];
    const tally = await applySteamRows(ids, send, (p) => progress.push(p.done));
    expect(send.mock.calls.map(([batch]) => batch.length)).toEqual([10, 10, 3]);
    expect(tally).toMatchObject({ updated: 11, imported: 12, skipped: 0, failed: [] });
    expect(progress).toEqual([0, 10, 20, 23]);
  });

  it('sends deferred ids again, first, until each has an outcome', async () => {
    const calls: string[][] = [];
    const send = async (batch: string[]) => {
      calls.push(batch);
      return {
        outcomes: batch.map((id, index) => done(id, index < 2 ? 'imported' : 'deferred')),
      };
    };
    const progress: number[] = [];
    const tally = await applySteamRows(['1', '2', '3', '4', '5'], send, (p) =>
      progress.push(p.done),
    );
    expect(calls).toEqual([['1', '2', '3', '4', '5'], ['3', '4', '5'], ['5']]);
    expect(tally.imported).toBe(5);
    expect(progress).toEqual([0, 2, 4, 5]);
  });

  it('collects failures and skipped games without stopping', async () => {
    const tally = await applySteamRows(['1', '2', '3'], async () => ({
      outcomes: [done('1', 'failed', 'boom'), done('2', 'skipped'), done('3', 'imported')],
    }));
    expect(tally).toMatchObject({ imported: 1, skipped: 1 });
    expect(tally.failed).toEqual([{ appId: '1', result: 'failed', error: 'boom' }]);
  });

  it('stops when a request fails and when the server makes no progress', async () => {
    await expect(
      applySteamRows(['1'], async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
    await expect(
      applySteamRows(['1'], async (batch) => ({
        outcomes: batch.map((id) => done(id, 'deferred')),
      })),
    ).rejects.toThrow('no progress');
  });

  it('ignores duplicate ids', async () => {
    const send = vi.fn(async (batch: string[]) => ({
      outcomes: batch.map((id) => done(id, 'imported')),
    }));
    await applySteamRows(['1', '1', '2'], send);
    expect(send).toHaveBeenCalledWith(['1', '2']);
  });
});
