import type { MediaStatus } from './MediaStatus.js';
import type { Viewing } from './Viewing.js';

/** The part of a season's tracking that its episodes drive. */
export interface SeasonTracking {
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rewatches: Viewing[];
}
