import { describe, expect, it } from 'vitest';
import {
  ratingChange,
  reviewChange,
  statusChange,
  watchedTodayChange,
  type QuickTracking,
} from '../src/logic/quickChanges';

const base: QuickTracking = {
  status: 'in_progress',
  startedAt: '2026-01-01',
  finishedAt: null,
  rating: null,
  review: null,
  rewatches: [],
  pendingReview: false,
};

describe('quick changes', () => {
  it('changes the status and undoes it when the rules allow the way back', () => {
    const change = statusChange(base, 'paused');
    expect(change.patch).toEqual({ status: 'paused' });
    expect(change.undo).toMatchObject({ status: 'in_progress', startedAt: '2026-01-01' });
  });

  it('offers no undo when the status rules forbid the way back', () => {
    expect(statusChange({ ...base, status: 'planned' }, 'completed').undo).toBeNull();
  });

  it('sets and clears the rating, restoring the previous one', () => {
    expect(ratingChange({ ...base, rating: 3 }, 6)).toEqual({
      patch: { rating: 6 },
      undo: { rating: 3 },
    });
    expect(ratingChange({ ...base, rating: 3 }, null).patch).toEqual({ rating: null });
  });

  it('records watching today, completes the item and asks for a review', () => {
    const change = watchedTodayChange(base, '2026-02-02');
    expect(change.patch).toEqual({
      finishedAt: '2026-02-02',
      status: 'completed',
      pendingReview: true,
    });
    expect(change.undo).toMatchObject({
      status: 'in_progress',
      finishedAt: null,
      pendingReview: false,
    });
  });

  it('keeps a written review out of the pending queue and a completed status as it is', () => {
    const change = watchedTodayChange(
      { ...base, status: 'completed', review: 'Great', finishedAt: '2026-01-05' },
      '2026-02-02',
    );
    expect(change.patch).toEqual({ finishedAt: '2026-02-02' });
    expect(change.undo).toMatchObject({ finishedAt: '2026-01-05' });
  });

  it('has no undo for watching today from a planned item', () => {
    expect(watchedTodayChange({ ...base, status: 'planned' }, '2026-02-02').undo).toBeNull();
  });

  it('trims the review and turns a blank one into none', () => {
    expect(reviewChange({ ...base, review: 'Old' }, '  New  ')).toEqual({
      patch: { review: 'New' },
      undo: { review: 'Old' },
    });
    expect(reviewChange(base, '  ').patch).toEqual({ review: null });
  });
});
