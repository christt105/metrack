import type { Season } from '@metrack/domain';
import { describe, expect, it } from 'vitest';
import { seasonWatched } from '../src/logic/seasonWatched';

const season = (patch: Partial<Season>) =>
  ({
    status: 'in_progress',
    episodeCount: 12,
    watchedCount: 0,
    skippedCount: 0,
    wantsRewatch: false,
    ...patch,
  }) as Season;

describe('seasonWatched', () => {
  it('uses the real watched count', () => {
    expect(seasonWatched(season({ watchedCount: 5 }))).toBe(5);
    expect(seasonWatched(season({ status: 'completed', watchedCount: 10 }))).toBe(10);
  });

  it('counts skipped episodes toward done', () => {
    expect(seasonWatched(season({ watchedCount: 40, skippedCount: 90 }))).toBe(130);
    expect(seasonWatched(season({ skippedCount: 3 }))).toBe(3);
  });

  it('counts a completed season without watches as all watched', () => {
    expect(seasonWatched(season({ status: 'completed' }))).toBe(12);
  });

  it('shows no progress for an unwatched or unsized season', () => {
    expect(seasonWatched(season({}))).toBeNull();
    expect(seasonWatched(season({ status: 'completed', episodeCount: null }))).toBeNull();
  });
});
