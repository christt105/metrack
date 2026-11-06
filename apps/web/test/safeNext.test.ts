import { describe, expect, it } from 'vitest';
import { safeNext } from '../src/logic/safeNext';

describe('safeNext', () => {
  it('keeps a path inside the app', () => {
    expect(safeNext('/movies/3?tab=x')).toBe('/movies/3?tab=x');
  });

  it('falls back to the library for anything that could leave the app or loop', () => {
    for (const next of [
      undefined,
      ['/a'],
      'https://evil.example',
      '//evil.example',
      '/\\evil',
      '/login',
    ]) {
      expect(safeNext(next)).toBe('/');
    }
  });
});
