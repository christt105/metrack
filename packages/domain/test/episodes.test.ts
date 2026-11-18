import { describe, expect, it } from 'vitest';
import {
  countWatchedEpisodes,
  isEpisodeCatalogStale,
  isSeasonAiring,
  normalizeEpisodeWatches,
  numberedEpisodes,
  episodeKey,
  idEpisodeWatches,
  parseEpisodeKey,
  type Episode,
} from '../src/index.js';

function episode(number: number, tmdbId: number | null, airDate: string | null = null): Episode {
  return { number, title: null, airDate, runtime: null, tmdbId, overview: null, stillPath: null };
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
      normalizeEpisodeWatches({ '0': [], '-1': [], a: [], '03': [], '4': 'x', '5': null, s1e2: 1 }),
    ).toEqual({
      '4': [],
      '5': [],
      s1e2: [],
    });
  });

  it('gives nothing for data that is not an object', () => {
    expect(normalizeEpisodeWatches(null)).toEqual({});
    expect(normalizeEpisodeWatches([1, 2])).toEqual({});
    expect(normalizeEpisodeWatches('x')).toEqual({});
  });
});

describe('countWatchedEpisodes', () => {
  const catalog = [episode(1, 10), episode(2, 20), episode(3, null)];

  it('counts the episodes of the season that have a key', () => {
    expect(countWatchedEpisodes(catalog, 2, {})).toBe(0);
    expect(
      countWatchedEpisodes(catalog, 2, {
        '10': [],
        s2e3: [{ startedAt: null, finishedAt: '2026-01-01' }],
        '999': [],
        s1e3: [],
      }),
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

describe('episodeKey and parseEpisodeKey', () => {
  it('uses the TMDB id when there is one', () => {
    expect(episodeKey(episode(3, 6701926), 1)).toBe('6701926');
  });

  it('falls back to the season and episode numbers', () => {
    expect(episodeKey(episode(3, null), 2)).toBe('s2e3');
    expect(episodeKey(episode(1, null), 0)).toBe('s0e1');
  });

  it('parses what it builds', () => {
    expect(parseEpisodeKey('6701926')).toEqual({ kind: 'tmdb', tmdbId: 6701926 });
    expect(parseEpisodeKey('s2e3')).toEqual({ kind: 'number', seasonNumber: 2, episodeNumber: 3 });
  });

  it('rejects anything else', () => {
    for (const key of ['', '0', '-1', '03', 'a', 's2', 'e3', 's2e0', 's-1e1', 's2e3x', '1.5']) {
      expect(parseEpisodeKey(key)).toBeNull();
    }
  });
});

describe('idEpisodeWatches', () => {
  const viewing = { startedAt: null, finishedAt: '2026-01-01' };
  const catalog = [episode(1, 10), episode(2, 20), episode(3, null)];

  it('moves numbering keys of the season to the ids of the same numbers', () => {
    expect(idEpisodeWatches(catalog, 2, { s2e1: [viewing], s2e2: [] })).toEqual({
      '10': [viewing],
      '20': [],
    });
  });

  it('leaves other seasons, episodes without an id and unknown numbers alone', () => {
    const watches = { s1e1: [viewing], s2e3: [], s2e9: [], '99': [] };
    expect(idEpisodeWatches(catalog, 2, watches)).toBe(watches);
  });

  it('keeps the existing watches of an id when both keys exist', () => {
    expect(idEpisodeWatches(catalog, 1, { s1e1: [], '10': [viewing] })).toEqual({
      '10': [viewing],
    });
  });

  it('returns the same object when nothing moves', () => {
    const watches = { '10': [viewing] };
    expect(idEpisodeWatches(catalog, 1, watches)).toBe(watches);
  });
});
