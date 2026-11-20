import { canTransition, normalizeViewings } from '@metrack/domain';
import type { MediaStatus, Viewing } from '@metrack/domain';
import type { QuickChange } from './QuickChange';

/** The tracking fields the quick actions read and restore. */
export interface QuickTracking {
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
  rewatches: Viewing[];
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
 * Records a viewing today. An unfinished item gets today as its finish date and completes when the status
 * rules allow it. A finished one keeps its first finish: it completes again (the server records the
 * rewatch) or, when already completed, gains a viewing finished today in its rewatches. Asks for a review when there is none.
 */
export function watchedTodayChange(current: QuickTracking, today: string): QuickChange {
  const patch: Record<string, unknown> = {};
  const canComplete = current.status !== 'completed' && canTransition(current.status, 'completed');
  if (current.finishedAt === null) {
    patch.finishedAt = today;
    if (canComplete) patch.status = 'completed';
  } else if (canComplete) {
    patch.status = 'completed';
  } else if (
    current.status === 'completed' &&
    today !== current.finishedAt &&
    !current.rewatches.some((v) => v.finishedAt === today)
  ) {
    patch.rewatches = normalizeViewings([
      ...current.rewatches,
      { startedAt: null, finishedAt: today },
    ]);
  }
  if (!current.review && !current.pendingReview) patch.pendingReview = true;
  return { patch, undo: snapshot(current) };
}

/** Publishes a pending item as it is, without a review. */
export function publishChange(current: QuickTracking): QuickChange {
  return { patch: { pendingReview: false }, undo: snapshot(current) };
}

/** Sets the minutes spent, or clears them with null. The undo puts the previous value back. */
export function hoursChange(current: number | null, minutes: number | null): QuickChange {
  return { patch: { timeSpentMinutes: minutes }, undo: { timeSpentMinutes: current } };
}

/** Saves the review text, blank meaning none. */
export function reviewChange(current: QuickTracking, text: string): QuickChange {
  const review = text.trim() === '' ? null : text.trim();
  return { patch: { review }, undo: snapshot(current) };
}
