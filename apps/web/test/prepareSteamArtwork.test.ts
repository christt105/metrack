import { describe, expect, it, vi } from 'vitest';
import { prepareSteamArtwork } from '../src/logic/prepareSteamArtwork';

describe('prepareSteamArtwork', () => {
  it('asks again until nothing remains and reports each count', async () => {
    const answers = [
      { processed: 2, remaining: 3 },
      { processed: 2, remaining: 1 },
      { processed: 1, remaining: 0 },
    ];
    const send = vi.fn(async () => answers.shift() ?? { processed: 0, remaining: 0 });
    const seen: number[] = [];
    expect(await prepareSteamArtwork(send, (left) => seen.push(left))).toBe(0);
    expect(send).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([3, 1, 0]);
  });

  it('stops without failing when a request finishes nothing', async () => {
    const send = vi.fn(async () => ({ processed: 0, remaining: 4 }));
    expect(await prepareSteamArtwork(send)).toBe(4);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('lets a failing request reject', async () => {
    await expect(
      prepareSteamArtwork(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
  });
});
