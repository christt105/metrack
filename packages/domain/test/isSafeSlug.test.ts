import { describe, expect, it } from 'vitest';
import { isSafeSlug } from '../src/index.js';

describe('isSafeSlug', () => {
  it.each([
    'Alpha (2020)',
    'Amélie (2001)',
    "Ocean's Eleven (2001)",
    'Mr. Robot - Season 1',
    'Sí, señor',
    'Nº 1',
    '...',
    'a..b',
  ])('accepts %j', (name) => {
    expect(isSafeSlug(name)).toBe(true);
  });

  it.each([
    '',
    ' ',
    '.',
    '..',
    '../..',
    '/',
    'a/b',
    'a\\b',
    '/etc',
    ' padded',
    'padded ',
    'a:b',
    'a#b',
    'a%2e',
    'a"b',
    'a[b]',
    'line\nbreak',
    'nul\u0000',
  ])('rejects %j', (name) => {
    expect(isSafeSlug(name)).toBe(false);
  });
});
