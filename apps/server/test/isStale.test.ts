import { describe, expect, it } from 'vitest';
import { defaultExpiryPolicy } from '../src/metadata/defaultExpiryPolicy.js';
import { isStale } from '../src/metadata/isStale.js';

const now = new Date('2026-10-24T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const settled = { releaseDate: '2015-01-01', finished: false };

describe('isStale', () => {
  it('is stale when never fetched', () => {
    expect(isStale(null, settled, defaultExpiryPolicy, now)).toBe(true);
  });

  it('uses the default TTL for settled titles', () => {
    expect(isStale(daysAgo(29), settled, defaultExpiryPolicy, now)).toBe(false);
    expect(isStale(daysAgo(30), settled, defaultExpiryPolicy, now)).toBe(true);
  });

  it('expires recent and upcoming releases first', () => {
    for (const releaseDate of ['2026-09-01', '2026-12-25']) {
      const lifecycle = { releaseDate, finished: true };
      expect(isStale(daysAgo(1), lifecycle, defaultExpiryPolicy, now)).toBe(false);
      expect(isStale(daysAgo(2), lifecycle, defaultExpiryPolicy, now)).toBe(true);
    }
  });

  it('keeps finished titles for much longer', () => {
    const lifecycle = { releaseDate: '2015-01-01', finished: true };
    expect(isStale(daysAgo(300), lifecycle, defaultExpiryPolicy, now)).toBe(false);
    expect(isStale(daysAgo(366), lifecycle, defaultExpiryPolicy, now)).toBe(true);
  });

  it('honours a custom policy and unknown release dates', () => {
    const policy = { ...defaultExpiryPolicy, defaultTtlDays: 1 };
    expect(isStale(daysAgo(2), { releaseDate: null, finished: false }, policy, now)).toBe(true);
  });
});
