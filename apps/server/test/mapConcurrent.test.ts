import { describe, expect, it } from 'vitest';
import { mapConcurrent } from '../src/titles/mapConcurrent.js';

describe('mapConcurrent', () => {
  it('keeps the order of the items and never exceeds the limit', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapConcurrent([5, 1, 4, 2, 3, 0], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, n * 5));
      running--;
      return n * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30, 0]);
    expect(peak).toBe(3);
  });

  it('handles no items', async () => {
    expect(await mapConcurrent([], 4, async (n: number) => n)).toEqual([]);
  });
});
