import { describe, expect, it, vi } from 'vitest';
import { refreshSteamAchievements } from '../src/logic/refreshSteamAchievements';

describe('refreshSteamAchievements', () => {
  it('sends the asOf of the first answer back until nothing remains and totals the pass', async () => {
    const answers = [
      { processed: 11, failed: 1, remaining: 14, asOf: 'T0' },
      { processed: 11, failed: 0, remaining: 3, asOf: 'T0' },
      { processed: 3, failed: 2, remaining: 0, asOf: 'T0' },
    ];
    const send = vi.fn(async () => answers.shift()!);
    const seen: [number, number][] = [];
    const pass = await refreshSteamAchievements(send, (done, total) => seen.push([done, total]));
    expect(pass).toEqual({ processed: 25, failed: 3, remaining: 0 });
    expect(send.mock.calls.map((call) => call as unknown[])).toEqual([
      [{}],
      [{ asOf: 'T0' }],
      [{ asOf: 'T0' }],
    ]);
    expect(seen).toEqual([
      [11, 25],
      [22, 25],
      [25, 25],
    ]);
  });

  it('stops without failing when a request checks nothing', async () => {
    const send = vi.fn(async () => ({ processed: 0, failed: 0, remaining: 4, asOf: 'T0' }));
    expect(await refreshSteamAchievements(send)).toEqual({ processed: 0, failed: 0, remaining: 4 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('lets a failing request reject', async () => {
    await expect(
      refreshSteamAchievements(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
  });
});
