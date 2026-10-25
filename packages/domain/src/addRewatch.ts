import type { Tracking } from './Tracking.js';

/** Records another viewing. Only completed items can be rewatched; dates are kept sorted and unique. */
export function addRewatch<T extends Tracking>(tracking: T, date: string): T {
  if (tracking.status !== 'completed') {
    throw new Error('Only completed items can be rewatched');
  }
  const rewatches = [...new Set([...tracking.rewatches, date])].sort();
  return { ...tracking, rewatches };
}
