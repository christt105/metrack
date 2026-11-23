import type { NextEpisodeRow } from '@metrack/domain';
import { describe, expect, it } from 'vitest';
import { replaceNextRow } from '../src/logic/replaceNextRow';

const at = (id: number) => ({ series: { id } }) as unknown as NextEpisodeRow;

describe('replaceNextRow', () => {
  it('puts the new row first and removes the old one', () => {
    const result = replaceNextRow([at(1), at(2), at(3)], 3, at(3));
    expect(result.map((r) => r.series.id)).toEqual([3, 1, 2]);
  });

  it('removes the row when there is no replacement', () => {
    expect(replaceNextRow([at(1), at(2)], 1, null).map((r) => r.series.id)).toEqual([2]);
  });
});
