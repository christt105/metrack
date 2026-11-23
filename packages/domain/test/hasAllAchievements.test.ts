import { describe, expect, it } from 'vitest';
import { hasAllAchievements } from '../src/hasAllAchievements.js';

describe('hasAllAchievements', () => {
  it('is true only when the total is positive and every achievement is unlocked', () => {
    expect(hasAllAchievements({ achievementsUnlocked: 40, achievementsTotal: 40 })).toBe(true);
    expect(hasAllAchievements({ achievementsUnlocked: 39, achievementsTotal: 40 })).toBe(false);
    expect(hasAllAchievements({ achievementsUnlocked: 0, achievementsTotal: 0 })).toBe(false);
  });

  it('is false while the counts are unknown', () => {
    expect(hasAllAchievements({ achievementsUnlocked: null, achievementsTotal: null })).toBe(false);
    expect(hasAllAchievements({ achievementsUnlocked: null, achievementsTotal: 3 })).toBe(false);
    expect(hasAllAchievements({})).toBe(false);
  });
});
