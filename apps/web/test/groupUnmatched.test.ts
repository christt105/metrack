import { describe, expect, it } from 'vitest';
import type { UnmatchedEpisode } from '@metrack/domain';
import { groupUnmatched } from '../src/logic/groupUnmatched';

const lost = (season: number, number: number | null): UnmatchedEpisode => ({
  code: 'episode_unmatched',
  season,
  number,
  name: null,
});

describe('groupUnmatched', () => {
  it('groups by season in order and links known seasons to their TMDB season page', () => {
    const groups = groupUnmatched([lost(2, 3), lost(1, 5), lost(2, 1)], 77, [1, 2]);
    expect(groups.map((g) => [g.season, g.episodes.map((e) => e.number), g.href])).toEqual([
      [1, [5], 'https://www.themoviedb.org/tv/77/season/1'],
      [2, [1, 3], 'https://www.themoviedb.org/tv/77/season/2'],
    ]);
  });

  it('links the series page when the season is not in the ordering, and nothing without a TMDB id', () => {
    expect(groupUnmatched([lost(4, 1)], 77, [1])[0]?.href).toBe('https://www.themoviedb.org/tv/77');
    expect(groupUnmatched([lost(1, 1)], null, [1])[0]?.href).toBeNull();
  });

  it('keeps one season when asked', () => {
    expect(groupUnmatched([lost(1, 1), lost(2, 1)], 77, [1, 2], 2).map((g) => g.season)).toEqual([
      2,
    ]);
  });
});
