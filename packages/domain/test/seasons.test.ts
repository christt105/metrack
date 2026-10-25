import { describe, expect, it } from 'vitest';
import { applySeasonOverrides, matchSeasonsByAirDate } from '../src/index.js';
import type { SeasonOverride, SeasonSource } from '../src/index.js';

const lupinTmdb: SeasonSource[] = [
  { number: 1, firstAirDate: '2021-01-08', episodeCount: 10 },
  { number: 2, firstAirDate: '2023-10-05', episodeCount: 7 },
  { number: 3, firstAirDate: '2026-10-23', episodeCount: 8 },
];
const lupinJellyfin: SeasonSource[] = [{ number: 4, firstAirDate: '2026-10-23', episodeCount: 3 }];

describe('Lupin: season 3 in TMDB is season 4 in TVDB and Jellyfin', () => {
  it('pairs by first episode date, not by number', () => {
    const result = matchSeasonsByAirDate(lupinJellyfin, lupinTmdb);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.preferred.number).toBe(4);
    expect(result.matched[0]?.fallback.number).toBe(3);
    expect(result.unmatchedPreferred).toEqual([]);
    expect(result.unmatchedFallback.map((s) => s.number)).toEqual([1, 2]);
  });

  it('season_override renumbers the TMDB season to the Jellyfin number', () => {
    const overrides: SeasonOverride[] = [
      { seriesId: 1, tmdbSeasonNumber: 3, number: 4, title: null, jellyfinSeasonId: null },
    ];
    const corrected = applySeasonOverrides(lupinTmdb, overrides);
    expect(corrected.map((s) => s.number)).toEqual([1, 2, 4]);
    expect(lupinTmdb[2]?.number).toBe(3);
  });

  it('applies an override title and leaves other fields alone', () => {
    const overrides: SeasonOverride[] = [
      { seriesId: 1, tmdbSeasonNumber: 3, number: null, title: 'Part 3', jellyfinSeasonId: 'abc' },
    ];
    expect(applySeasonOverrides(lupinTmdb, overrides)[2]).toEqual({
      ...lupinTmdb[2],
      title: 'Part 3',
    });
  });
});

describe('Dan Da Dan: TMDB has one 24 episode season, Jellyfin has two of 12', () => {
  const tmdb: SeasonSource[] = [{ number: 1, firstAirDate: '2024-10-04', episodeCount: 24 }];
  const jellyfin: SeasonSource[] = [
    { number: 1, firstAirDate: '2024-10-04', episodeCount: 12 },
    { number: 2, firstAirDate: '2025-07-03', episodeCount: 12 },
  ];

  it('keeps the Jellyfin structure and links the first season', () => {
    const result = matchSeasonsByAirDate(jellyfin, tmdb);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.preferred.number).toBe(1);
    expect(result.matched[0]?.fallback.episodeCount).toBe(24);
    expect(result.unmatchedPreferred.map((s) => s.number)).toEqual([2]);
    expect(result.unmatchedFallback).toEqual([]);
  });
});

describe('matchSeasonsByAirDate', () => {
  it('tolerates a few days of difference and rejects larger gaps', () => {
    const a: SeasonSource[] = [{ number: 1, firstAirDate: '2024-01-10', episodeCount: 8 }];
    const near: SeasonSource[] = [{ number: 1, firstAirDate: '2024-01-12', episodeCount: 8 }];
    const far: SeasonSource[] = [{ number: 1, firstAirDate: '2024-02-12', episodeCount: 8 }];
    expect(matchSeasonsByAirDate(a, near).matched).toHaveLength(1);
    expect(matchSeasonsByAirDate(a, far).matched).toHaveLength(0);
  });

  it('matches a single season series as one season', () => {
    const only: SeasonSource[] = [{ number: 1, firstAirDate: '2026-05-29', episodeCount: 4 }];
    const result = matchSeasonsByAirDate(only, only);
    expect(result.matched).toHaveLength(1);
    expect(result.unmatchedPreferred).toEqual([]);
    expect(result.unmatchedFallback).toEqual([]);
  });
});
