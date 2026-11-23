import type { SeasonTracking } from './SeasonTracking.js';

/**
 * Takes back the last start over: the last abandoned pass is removed and the season is in progress again with
 * that pass's start, to be derived from its watches again. Null when the season has no abandoned pass.
 */
export function undoRestart(tracking: SeasonTracking): SeasonTracking | null {
  const last = tracking.abandoned[tracking.abandoned.length - 1];
  if (last === undefined) return null;
  return {
    ...tracking,
    status: 'in_progress',
    startedAt: last.startedAt,
    finishedAt: null,
    abandoned: tracking.abandoned.slice(0, -1),
  };
}
