import { RATING_LEVELS } from '@metrack/domain';
import { describe, expect, it } from 'vitest';
import { ratingDisplay } from '../src/logic/ratingDisplay';

describe('ratingDisplay', () => {
  it('gives every level an icon, an English word and its colour', () => {
    const words = RATING_LEVELS.map((level) => ratingDisplay(level.rating).label);
    expect(words).toEqual([
      'Masterpiece',
      'Amazing',
      'Good',
      'Decent',
      'Bad',
      'Terrible',
      'Abysmal',
    ]);
    expect(ratingDisplay(7)).toEqual({ icon: 'crown', label: 'Masterpiece', color: '#a855f7' });
    expect(ratingDisplay(1)).toEqual({ icon: 'skull', label: 'Abysmal', color: '#b91c1c' });
  });

  it('falls back to a neutral look for legacy values, never a number', () => {
    for (const legacy of [0, 8.5, 10]) {
      const display = ratingDisplay(legacy);
      expect(display.icon).toBe('star');
      expect(display.label).toBe('Rated');
      expect(display.color).toBe('var(--muted)');
    }
  });
});
