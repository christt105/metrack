import type { MediaStatus } from './MediaStatus.js';
import type { Tracking } from './Tracking.js';
import { normalizeViewings } from './normalizeViewings.js';
import type { Viewing } from './Viewing.js';

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

function hasOpen(viewings: readonly Viewing[]): boolean {
  return viewings.some((v) => v.finishedAt === null);
}

/**
 * Moves tracking to a new status. The start date is optional: entering `in_progress` sets
 * `startedAt` to `today` only for a first viewing (no start and no finish yet), and entering
 * `completed` never sets it. Entering `completed` sets `finishedAt` to `today`, unless the item was
 * already finished: `finishedAt` keeps the first finish. Leaving `completed` for `in_progress` opens a
 * viewing starting today, and completing again closes it with today; on the finish day itself the open
 * viewing is dropped instead. Without an open viewing (older data) a later finish is recorded as a viewing
 * without a start. Pausing keeps the open viewing, planning or dropping discards it. Throws on a
 * disallowed transition.
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
  let viewings = tracking.rewatches;
  if (to === 'in_progress') {
    if (tracking.startedAt === null && tracking.finishedAt === null) next.startedAt = today;
    if (tracking.status === 'completed' && !hasOpen(viewings)) {
      viewings = [...viewings, { startedAt: today, finishedAt: null }];
    }
  }
  if (to === 'completed') {
    if (tracking.finishedAt === null) {
      next.finishedAt = today;
    } else if (today > tracking.finishedAt) {
      const open = viewings.find((v) => v.finishedAt === null);
      viewings = open
        ? [...viewings.filter((v) => v.finishedAt !== null), { ...open, finishedAt: today }]
        : [...viewings, { startedAt: null, finishedAt: today }];
    } else {
      viewings = viewings.filter((v) => v.finishedAt !== null);
    }
  }
  if (to === 'planned' || to === 'dropped') {
    viewings = viewings.filter((v) => v.finishedAt !== null);
  }
  if (viewings !== tracking.rewatches) next.rewatches = normalizeViewings(viewings);
  return next;
}
