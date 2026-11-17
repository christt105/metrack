import { canTransition } from '@metrack/domain';
import type { MediaStatus } from '@metrack/domain';
import type { QuickChange } from './QuickChange';

/** The tracking fields the quick actions read and restore. */
export interface QuickTracking {
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
  rewatches: string[];
  pendingReview: boolean;
}

function snapshot(current: QuickTracking): Record<string, unknown> {
  return {
    restore: true,
    status: current.status,
    startedAt: current.startedAt,
    finishedAt: current.finishedAt,
    rating: current.rating,
    review: current.review,
    rewatches: current.rewatches,
    pendingReview: current.pendingReview,
  };
}

/** Moves to another status. */
export function statusChange(current: QuickTracking, next: MediaStatus): QuickChange {
  return { patch: { status: next }, undo: snapshot(current) };
}

/** Sets the rating, or clears it with null. */
export function ratingChange(current: QuickTracking, rating: number | null): QuickChange {
  return { patch: { rating }, undo: snapshot(current) };
}

/**
 * Records a finish today: completes the item when the status rules allow it, sets the finish date to
 * today and asks for a review when there is none yet.
 */
export function watchedTodayChange(current: QuickTracking, today: string): QuickChange {
  const patch: Record<string, unknown> = { finishedAt: today };
  if (current.status !== 'completed' && canTransition(current.status, 'completed')) {
    patch.status = 'completed';
  }
  if (!current.review && !current.pendingReview) patch.pendingReview = true;
  return { patch, undo: snapshot(current) };
}

/** Publishes a pending item as it is, without a review. */
export function publishChange(current: QuickTracking): QuickChange {
  return { patch: { pendingReview: false }, undo: snapshot(current) };
}

/** Saves the review text, blank meaning none. */
export function reviewChange(current: QuickTracking, text: string): QuickChange {
  const review = text.trim() === '' ? null : text.trim();
  return { patch: { review }, undo: snapshot(current) };
}
