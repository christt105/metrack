import { describe, expect, it } from 'vitest';
import {
  publishChange,
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

const snapshot = (tracking: QuickTracking) => ({ restore: true, ...tracking });

describe('quick changes', () => {
  it('changes the status and always carries a full restore snapshot', () => {
    const change = statusChange(base, 'paused');
    expect(change.patch).toEqual({ status: 'paused' });
    expect(change.undo).toEqual(snapshot(base));
  });

  it('restores even where the status rules forbid the way back', () => {
    const planned = { ...base, status: 'planned' as const, startedAt: null };
    expect(statusChange(planned, 'completed').undo).toEqual(snapshot(planned));
    expect(watchedTodayChange(planned, '2026-02-02').undo).toEqual(snapshot(planned));
  });

  it('sets and clears the rating, restoring the previous one', () => {
    const rated = { ...base, rating: 3 };
    expect(ratingChange(rated, 6)).toEqual({ patch: { rating: 6 }, undo: snapshot(rated) });
    expect(ratingChange(rated, null).patch).toEqual({ rating: null });
  });

  it('records watching today, completes the item and asks for a review', () => {
    const change = watchedTodayChange(base, '2026-02-02');
    expect(change.patch).toEqual({
      finishedAt: '2026-02-02',
      status: 'completed',
      pendingReview: true,
    });
    expect(change.undo).toEqual(snapshot(base));
  });

  it('keeps a written review out of the pending queue and a completed status as it is', () => {
    const done = {
      ...base,
      status: 'completed' as const,
      review: 'Great',
      finishedAt: '2026-01-05',
    };
    expect(watchedTodayChange(done, '2026-02-02').patch).toEqual({
      rewatches: [{ startedAt: null, finishedAt: '2026-02-02' }],
    });
  });

  it('never overwrites the first finish of a completed item', () => {
    const done = {
      ...base,
      status: 'completed' as const,
      review: 'Great',
      finishedAt: '2026-01-05',
      rewatches: [{ startedAt: '2026-02-20', finishedAt: '2026-03-01' }],
    };
    expect(watchedTodayChange(done, '2026-02-02').patch).toEqual({
      rewatches: [
        { startedAt: null, finishedAt: '2026-02-02' },
        { startedAt: '2026-02-20', finishedAt: '2026-03-01' },
      ],
    });
    expect(watchedTodayChange(done, '2026-01-05').patch).toEqual({});
    expect(watchedTodayChange(done, '2026-03-01').patch).toEqual({});
    expect(watchedTodayChange({ ...done, review: null }, '2026-01-05').patch).toEqual({
      pendingReview: true,
    });
  });

  it('completes a rewatch in progress without sending a finish date', () => {
    const rewatching = { ...base, finishedAt: '2026-01-05', review: 'Great' };
    const change = watchedTodayChange(rewatching, '2026-02-02');
    expect(change.patch).toEqual({ status: 'completed' });
    expect(change.undo).toEqual(snapshot(rewatching));
  });

  it('publishes a pending item and restores it as pending', () => {
    const pending = { ...base, pendingReview: true };
    const change = publishChange(pending);
    expect(change.patch).toEqual({ pendingReview: false });
    expect(change.undo).toMatchObject({ restore: true, pendingReview: true });
  });

  it('trims the review and turns a blank one into none', () => {
    const reviewed = { ...base, review: 'Old' };
    expect(reviewChange(reviewed, '  New  ')).toEqual({
      patch: { review: 'New' },
      undo: snapshot(reviewed),
    });
    expect(reviewChange(base, '  ').patch).toEqual({ review: null });
  });
});
