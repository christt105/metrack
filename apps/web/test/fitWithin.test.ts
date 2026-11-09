import { describe, expect, it } from 'vitest';
import { fitWithin } from '../src/logic/fitWithin';

describe('fitWithin', () => {
  it('keeps a size that already fits', () => {
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 });
  });

  it('scales the longest side down to the limit, keeping the proportions', () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWithin(3000, 6000, 1920)).toEqual({ width: 960, height: 1920 });
  });

  it('never makes a side smaller than one pixel', () => {
    expect(fitWithin(100000, 10, 1920)).toEqual({ width: 1920, height: 1 });
  });
});
