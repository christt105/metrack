import { describe, expect, it } from 'vitest';
import { mergeMovieViewings } from '../src/sync/mergeMovieViewings.js';

describe('mergeMovieViewings', () => {
  it('keeps stored starts and adds missing finish dates as viewings without a start', () => {
    const stored = [{ startedAt: '2026-02-01', finishedAt: '2026-02-03' }];
    expect(mergeMovieViewings(stored, ['2026-02-03', '2026-04-01'])).toEqual([
      { startedAt: '2026-02-01', finishedAt: '2026-02-03' },
      { startedAt: null, finishedAt: '2026-04-01' },
    ]);
  });

  it('closes the open viewing with the first new date on or after its start', () => {
    const stored = [{ startedAt: '2026-05-01', finishedAt: null }];
    expect(mergeMovieViewings(stored, ['2026-03-10', '2026-05-02'])).toEqual([
      { startedAt: null, finishedAt: '2026-03-10' },
      { startedAt: '2026-05-01', finishedAt: '2026-05-02' },
    ]);
  });

  it('drops the open viewing when no new date can close it', () => {
    const stored = [{ startedAt: '2026-05-01', finishedAt: null }];
    expect(mergeMovieViewings(stored, ['2026-03-10'])).toEqual([
      { startedAt: null, finishedAt: '2026-03-10' },
    ]);
  });
});
