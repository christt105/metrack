import { describe, expect, it } from 'vitest';
import { canonicalPlatform, normalizePlatforms, steamPlatforms } from '../src/index.js';

describe('platforms', () => {
  it('collapses equivalent spellings into one canonical name', () => {
    expect(canonicalPlatform('Windows')).toBe('PC');
    expect(canonicalPlatform('PC (Microsoft Windows)')).toBe('PC');
    expect(canonicalPlatform('PlayStation 5')).toBe('PS5');
    expect(canonicalPlatform('  nintendo   switch ')).toBe('Switch');
  });

  it('keeps unknown platforms as they were written, trimmed', () => {
    expect(canonicalPlatform('  Amiga 500 ')).toBe('Amiga 500');
  });

  it('drops blanks and repeats and keeps the first-seen order', () => {
    expect(normalizePlatforms(['Windows', '', 'PS5', 'PC', 'PlayStation 5', 'Amiga'])).toEqual([
      'PC',
      'PS5',
      'Amiga',
    ]);
  });

  it('turns the Steam Deck of a Steam import into PC', () => {
    expect(steamPlatforms(['Steam Deck', 'PC (Microsoft Windows)', 'Switch'])).toEqual([
      'PC',
      'Switch',
    ]);
    expect(normalizePlatforms(['Steam Deck'])).toEqual(['Steam Deck']);
  });
});
