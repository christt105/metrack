import { describe, expect, it } from 'vitest';
import {
  countWatchedEpisodes,
  isEpisodeCatalogStale,
  isSeasonAiring,
  matchEpisodeCatalog,
  normalizeEpisodeWatches,
  numberedEpisodes,
  remapEpisodeWatches,
  type Episode,
} from '../src/index.js';

function episode(number: number, tmdbId: number | null, airDate: string | null = null): Episode {
  return { number, title: null, airDate, runtime: null, tmdbId, overview: null };
}

describe('normalizeEpisodeWatches', () => {
  it('keeps valid keys and normalizes their viewings', () => {
    expect(
      normalizeEpisodeWatches({
        '1': [{ startedAt: null, finishedAt: '2026-01-02' }, '2026-01-01'],
        '2': [],
      }),
    ).toEqual({
      '1': [
        { startedAt: null, finishedAt: '2026-01-01' },
        { startedAt: null, finishedAt: '2026-01-02' },
      ],
      '2': [],
    });
  });

  it('drops bad keys and treats non-list values as watched without a date', () => {
    expect(
      normalizeEpisodeWatches({ '0': [], '-1': [], a: [], '03': [], '4': 'x', '5': null }),
    ).toEqual({
      '4': [],
      '5': [],
    });
  });

  it('gives nothing for data that is not an object', () => {
    expect(normalizeEpisodeWatches(null)).toEqual({});
    expect(normalizeEpisodeWatches([1, 2])).toEqual({});
    expect(normalizeEpisodeWatches('x')).toEqual({});
  });
});

describe('countWatchedEpisodes', () => {
  it('counts keys', () => {
    expect(countWatchedEpisodes({})).toBe(0);
    expect(
      countWatchedEpisodes({ '1': [], '3': [{ startedAt: null, finishedAt: '2026-01-01' }] }),
    ).toBe(2);
  });
});

describe('isEpisodeCatalogStale', () => {
  const now = new Date('2026-11-17T12:00:00.000Z');

  it('treats a missing catalog as stale', () => {
    expect(isEpisodeCatalogStale(null, now, false)).toBe(true);
    expect(isEpisodeCatalogStale('garbage', now, false)).toBe(true);
  });

  it('goes stale after a day when airing', () => {
    expect(isEpisodeCatalogStale('2026-11-16T12:00:01.000Z', now, true)).toBe(false);
    expect(isEpisodeCatalogStale('2026-11-16T12:00:00.000Z', now, true)).toBe(true);
  });

  it('goes stale after 30 days otherwise', () => {
    expect(isEpisodeCatalogStale('2026-10-19T12:00:01.000Z', now, false)).toBe(false);
    expect(isEpisodeCatalogStale('2026-10-18T12:00:00.000Z', now, false)).toBe(true);
  });
});

describe('isSeasonAiring', () => {
  const now = new Date('2026-11-17T12:00:00.000Z');
  const next = { seasonNumber: 2, episodeNumber: 4, airDate: '2026-11-20', name: null };

  it('is airing when the next episode belongs to the season', () => {
    expect(isSeasonAiring(next, 2, [], now)).toBe(true);
    expect(isSeasonAiring(next, 1, [], now)).toBe(false);
  });

  it('is airing with an episode from the last 30 days or in the future', () => {
    expect(isSeasonAiring(null, 1, [episode(1, 1, '2026-10-18')], now)).toBe(true);
    expect(isSeasonAiring(null, 1, [episode(1, 1, '2027-01-01')], now)).toBe(true);
  });

  it('is not airing when every episode is older or undated', () => {
    expect(isSeasonAiring(null, 1, [episode(1, 1, '2026-10-17'), episode(2, 2)], now)).toBe(false);
    expect(isSeasonAiring(null, 1, [], now)).toBe(false);
  });
});

describe('numberedEpisodes', () => {
  it('lists bare numbers', () => {
    expect(numberedEpisodes(2)).toEqual([episode(1, null), episode(2, null)]);
  });

  it('is empty without a usable count', () => {
    expect(numberedEpisodes(null)).toEqual([]);
    expect(numberedEpisodes(0)).toEqual([]);
    expect(numberedEpisodes(-3)).toEqual([]);
  });
});

describe('remapEpisodeWatches', () => {
  const viewing = { startedAt: null, finishedAt: '2026-01-01' };

  it('moves watches to the number the same TMDB id has now', () => {
    const before = [episode(1, 10), episode(2, 20), episode(3, 30)];
    const after = [episode(1, 30), episode(2, 10), episode(3, 20)];
    expect(remapEpisodeWatches(before, after, { '1': [viewing], '3': [] })).toEqual({
      '2': [viewing],
      '1': [],
    });
  });

  it('keeps keys that have no match', () => {
    const before = [episode(1, 10), episode(2, null)];
    const after = [episode(1, 99), episode(2, 10)];
    expect(remapEpisodeWatches(before, after, { '1': [viewing], '2': [], '7': [] })).toEqual({
      '2': [viewing],
      '7': [],
    });
  });

  it('leaves watches alone when nothing moved', () => {
    const same = [episode(1, 10), episode(2, 20)];
    expect(remapEpisodeWatches(same, same, { '2': [viewing] })).toEqual({ '2': [viewing] });
  });
});

describe('matchEpisodeCatalog', () => {
  const today = '2026-11-17';
  const aired = (count: number): Episode[] =>
    Array.from({ length: count }, (_, i) => episode(i + 1, i + 1, '2026-01-01'));

  it('applies when the aired episodes equal the stored count', () => {
    expect(matchEpisodeCatalog(12, aired(12), today)).toEqual({ applies: true, mismatch: null });
  });

  it('applies without a stored count', () => {
    expect(matchEpisodeCatalog(null, aired(60), today).applies).toBe(true);
  });

  it('applies when the catalog is longer only by episodes still to air or without a date', () => {
    const list = [...aired(10), episode(11, 11, '2026-12-01'), episode(12, 12, null)];
    expect(matchEpisodeCatalog(11, list, today)).toEqual({ applies: true, mismatch: null });
    expect(
      matchEpisodeCatalog(10, [...aired(10), episode(11, 11, '2026-12-01')], today).applies,
    ).toBe(true);
  });

  it('does not apply when TMDB merges seasons: 60 aired against 24', () => {
    expect(matchEpisodeCatalog(24, aired(60), today)).toEqual({
      applies: false,
      mismatch: { catalogEpisodes: 60 },
    });
  });

  it('does not apply when the catalog is shorter', () => {
    expect(matchEpisodeCatalog(24, aired(12), today)).toEqual({
      applies: false,
      mismatch: { catalogEpisodes: 12 },
    });
  });

  it('counts an episode that airs today as aired', () => {
    expect(matchEpisodeCatalog(1, [episode(1, 1, today)], today).applies).toBe(true);
  });
});
