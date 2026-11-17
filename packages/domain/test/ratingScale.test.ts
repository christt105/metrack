import { describe, expect, it } from 'vitest';
import { RATING_LEVELS, RATING_MAX, RATING_MIN, ratingLevel } from '../src/index.js';

describe('rating scale', () => {
  it('lists seven levels from the best to the worst', () => {
    expect(RATING_LEVELS.map((level) => level.rating)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(RATING_MIN).toBe(1);
    expect(RATING_MAX).toBe(7);
    expect(new Set(RATING_LEVELS.map((level) => level.icon)).size).toBe(7);
    expect(new Set(RATING_LEVELS.map((level) => level.color)).size).toBe(7);
  });

  it('maps a stored rating to its level', () => {
    expect(ratingLevel(7)).toEqual({ rating: 7, color: '#a855f7', icon: 'crown' });
    expect(ratingLevel(1)?.icon).toBe('skull');
  });

  it('has no level for values outside the scale', () => {
    for (const value of [0, 8, 5.5, 10, -1, Number.NaN]) expect(ratingLevel(value)).toBeNull();
  });
});
