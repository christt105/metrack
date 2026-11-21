import { describe, expect, it } from 'vitest';
import type { FillerCategory, FillerPreviewEpisode } from '@metrack/domain';
import {
  categoryState,
  defaultSelection,
  isSkippable,
  setCategory,
  skipGroups,
} from '../src/logic/fillerSelection';

function ep(
  seasonId: number,
  number: number,
  category: FillerCategory,
  flags: Partial<Pick<FillerPreviewEpisode, 'watched' | 'skipped'>> = {},
): FillerPreviewEpisode {
  return {
    seasonId,
    seasonNumber: seasonId,
    key: `k${seasonId}-${number}`,
    number,
    title: null,
    absoluteNumber: seasonId * 100 + number,
    category,
    watched: false,
    skipped: false,
    ...flags,
  };
}

const episodes = [
  ep(1, 1, 'mangaCanon'),
  ep(1, 2, 'filler'),
  ep(1, 3, 'filler', { watched: true }),
  ep(1, 4, 'mixed'),
  ep(2, 1, 'filler', { skipped: true }),
  ep(2, 2, 'filler'),
  ep(2, 3, 'animeCanon'),
  ep(2, 4, 'mixed'),
];

describe('fillerSelection', () => {
  it('only offers unwatched, unskipped filler and mixed episodes', () => {
    expect(episodes.filter(isSkippable).map((e) => e.key)).toEqual([
      'k1-2',
      'k1-4',
      'k2-2',
      'k2-4',
    ]);
  });

  it('preselects filler and not mixed', () => {
    expect([...defaultSelection(episodes)]).toEqual(['1:k1-2', '2:k2-2']);
  });

  it('selects and clears a whole category without touching ineligible episodes', () => {
    const withMixed = setCategory(defaultSelection(episodes), episodes, 'mixed', true);
    expect([...withMixed].sort()).toEqual(['1:k1-2', '1:k1-4', '2:k2-2', '2:k2-4']);
    expect(categoryState(withMixed, episodes, 'mixed')).toBe('all');
    const cleared = setCategory(withMixed, episodes, 'filler', false);
    expect(categoryState(cleared, episodes, 'filler')).toBe('none');
    expect(categoryState(new Set(['1:k1-2']), episodes, 'filler')).toBe('some');
    expect(setCategory(new Set(), episodes, 'mangaCanon', true).size).toBe(0);
  });

  it('groups the selection by season in order', () => {
    expect(skipGroups(new Set(['2:k2-2', '1:k1-2', '1:k1-4', '1:k1-3']), episodes)).toEqual([
      { seasonId: 1, keys: ['k1-2', 'k1-4'] },
      { seasonId: 2, keys: ['k2-2'] },
    ]);
    expect(skipGroups(new Set(), episodes)).toEqual([]);
  });
});
