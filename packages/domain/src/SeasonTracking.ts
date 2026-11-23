import type { AbandonedPass } from './AbandonedPass.js';
import type { MediaStatus } from './MediaStatus.js';
import type { Viewing } from './Viewing.js';

/** The part of a season's tracking that its episodes drive. */
export interface SeasonTracking {
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rewatches: Viewing[];
  /** The passes left to start the season over, oldest first; the current pass begins at the last `restartedOn`. */
  abandoned: AbandonedPass[];
}
