import type { MediaStatus } from './MediaStatus.js';
import type { Tracking } from './Tracking.js';

const ALLOWED: Record<MediaStatus, readonly MediaStatus[]> = {
  planned: ['in_progress', 'completed', 'dropped'],
  in_progress: ['paused', 'dropped', 'completed', 'planned'],
  paused: ['in_progress', 'dropped', 'completed'],
  dropped: ['planned', 'in_progress'],
  completed: ['in_progress'],
};

export function canTransition(from: MediaStatus, to: MediaStatus): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * Moves tracking to a new status. Entering `in_progress` sets `startedAt` if missing. Entering
 * `completed` sets `startedAt` if missing and `finishedAt` to `today`, unless the item was already
 * finished: `finishedAt` keeps the first finish and a later one is recorded as a rewatch, so going
 * back to `in_progress` and completing again never loses a viewing. Throws on a disallowed
 * transition.
 */
export function transitionStatus<T extends Tracking>(
  tracking: T,
  to: MediaStatus,
  today: string,
): T {
  if (!canTransition(tracking.status, to)) {
    throw new Error(`Invalid status transition from ${tracking.status} to ${to}`);
  }
  const next: T = { ...tracking, status: to };
  if (to === 'in_progress') {
    next.startedAt = tracking.startedAt ?? today;
  }
  if (to === 'completed') {
    next.startedAt = tracking.startedAt ?? today;
    if (tracking.finishedAt === null) {
      next.finishedAt = today;
    } else if (today > tracking.finishedAt) {
      next.rewatches = [...new Set([...tracking.rewatches, today])].sort();
    }
  }
  return next;
}
