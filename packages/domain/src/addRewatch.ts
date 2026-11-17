import type { Tracking } from './Tracking.js';
import { normalizeViewings } from './normalizeViewings.js';

/** Records another viewing. Only completed items can be rewatched; viewings stay normalized. The start is optional. */
export function addRewatch<T extends Tracking>(
  tracking: T,
  finishedAt: string,
  startedAt: string | null = null,
): T {
  if (tracking.status !== 'completed') {
    throw new Error('Only completed items can be rewatched');
  }
  return {
    ...tracking,
    rewatches: normalizeViewings([...tracking.rewatches, { startedAt, finishedAt }]),
  };
}
