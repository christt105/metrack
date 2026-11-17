import { describe, expect, it } from 'vitest';
import { LibraryCache } from '../src/library/LibraryCache';

const page = (total: number) => ({ total, items: [] });

describe('LibraryCache', () => {
  it('returns what was stored and forgets it on clear', () => {
    const cache = new LibraryCache();
    expect(cache.get({ q: 'a' })).toBeUndefined();
    cache.set({ q: 'a' }, page(1));
    expect(cache.get({ q: 'a' })?.total).toBe(1);
    cache.clear();
    expect(cache.get({ q: 'a' })).toBeUndefined();
  });

  it('keys by content, not by property order or undefined values', () => {
    const cache = new LibraryCache();
    cache.set({ q: 'a', sort: 'recent', order: 'desc' }, page(2));
    expect(cache.get({ order: 'desc', type: undefined, sort: 'recent', q: 'a' })?.total).toBe(2);
    expect(cache.get({ q: 'b', sort: 'recent', order: 'desc' })).toBeUndefined();
  });

  it('drops the least recently used page beyond its capacity', () => {
    const cache = new LibraryCache(2);
    cache.set({ q: '1' }, page(1));
    cache.set({ q: '2' }, page(2));
    cache.get({ q: '1' });
    cache.set({ q: '3' }, page(3));
    expect(cache.get({ q: '2' })).toBeUndefined();
    expect(cache.get({ q: '1' })?.total).toBe(1);
    expect(cache.get({ q: '3' })?.total).toBe(3);
  });
});
