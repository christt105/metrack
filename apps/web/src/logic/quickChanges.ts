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

function revertStatus(from: MediaStatus, to: MediaStatus): boolean {
  return from === to || canTransition(from, to);
}

/** Moves to another status. Undo is only offered when the status rules allow the way back. */
export function statusChange(current: QuickTracking, next: MediaStatus): QuickChange {
  const undo: Record<string, unknown> = {
    startedAt: current.startedAt,
    finishedAt: current.finishedAt,
    rewatches: current.rewatches,
  };
  return {
    patch: { status: next },
    undo: revertStatus(next, current.status) ? { ...undo, status: current.status } : null,
  };
}

/** Sets the rating, or clears it with null. */
export function ratingChange(current: QuickTracking, rating: number | null): QuickChange {
  return { patch: { rating }, undo: { rating: current.rating } };
}

/**
 * Records a finish today: completes the item when the status rules allow it, sets the finish date to
 * today and asks for a review when there is none yet.
 */
export function watchedTodayChange(current: QuickTracking, today: string): QuickChange {
  const patch: Record<string, unknown> = { finishedAt: today };
  const completes = current.status !== 'completed' && canTransition(current.status, 'completed');
  if (completes) patch.status = 'completed';
  if (!current.review && !current.pendingReview) patch.pendingReview = true;
  const undo: Record<string, unknown> = {
    startedAt: current.startedAt,
    finishedAt: current.finishedAt,
    rewatches: current.rewatches,
    pendingReview: current.pendingReview,
  };
  if (completes) {
    if (!revertStatus('completed', current.status)) return { patch, undo: null };
    undo.status = current.status;
  }
  return { patch, undo };
}

/** Saves the review text, blank meaning none. */
export function reviewChange(current: QuickTracking, text: string): QuickChange {
  const review = text.trim() === '' ? null : text.trim();
  return { patch: { review }, undo: { review: current.review } };
}
