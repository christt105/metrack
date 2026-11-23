import { describe, expect, it } from 'vitest';
import { mergeAchievements } from '../src/steam/mergeAchievements.js';

const schema = [
  { name: 'A', displayName: 'Alpha', description: 'a', icon: 'ia', icongray: 'ga' },
  { name: 'B', displayName: 'Beta', hidden: 1, description: 'b', icon: 'ib', icongray: 'gb' },
  { name: 'C', displayName: 'Gamma', description: '', icon: 'ic', icongray: 'gc' },
  { name: 'D', displayName: 'Delta', hidden: 1, description: 'd', icon: 'id', icongray: 'gd' },
];

describe('mergeAchievements', () => {
  it('puts unlocked first by latest unlock, then locked in schema order', () => {
    const merged = mergeAchievements(schema, [
      { apiname: 'A', achieved: 1, unlocktime: 100 },
      { apiname: 'B', achieved: 0, unlocktime: 0 },
      { apiname: 'D', achieved: 1, unlocktime: 200 },
    ]);
    expect(merged.map((a) => a.apiName)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('shows the colour icon only when unlocked and hides locked secrets, not unlocked ones', () => {
    const merged = mergeAchievements(schema, [
      { apiname: 'B', achieved: 1, unlocktime: 50 },
      { apiname: 'D', achieved: 0 },
    ]);
    const byName = Object.fromEntries(merged.map((a) => [a.apiName, a]));
    expect(byName.B).toMatchObject({
      iconUrl: 'ib',
      description: 'b',
      hidden: true,
      unlocked: true,
    });
    expect(byName.D).toMatchObject({
      iconUrl: 'gd',
      description: null,
      hidden: true,
      unlocked: false,
    });
    expect(byName.A?.iconUrl).toBe('ga');
    expect(byName.C?.description).toBeNull();
  });

  it('treats an unlock without a time as unlocked with no date and falls back to the api name', () => {
    const merged = mergeAchievements(
      [{ name: 'X', icon: 'ix', icongray: 'gx' }],
      [{ apiname: 'X', achieved: 1, unlocktime: 0 }],
    );
    expect(merged).toEqual([
      {
        apiName: 'X',
        name: 'X',
        description: null,
        hidden: false,
        iconUrl: 'ix',
        unlocked: true,
        unlockedAt: null,
      },
    ]);
  });
});
