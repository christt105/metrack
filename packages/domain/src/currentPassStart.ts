import type { AbandonedPass } from './AbandonedPass.js';
import { lastRestart } from './lastRestart.js';
import { openRewatchStart } from './openRewatchStart.js';
import type { Viewing } from './Viewing.js';

/**
 * The day before which an episode viewing does not count as done for a season: the start of the open rewatch, or
 * else the day the season was last started over, or null when neither applies.
 */
export function currentPassStart(tracking: {
  rewatches: readonly Viewing[];
  abandoned: readonly AbandonedPass[];
}): string | null {
  return openRewatchStart(tracking.rewatches) ?? lastRestart(tracking.abandoned);
}
