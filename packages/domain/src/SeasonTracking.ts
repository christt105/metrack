import type { ManualTracking } from './ManualTracking.js';
import type { MediaStatus } from './MediaStatus.js';
import type { Viewing } from './Viewing.js';

/** The part of a season's tracking that its episodes drive, plus the user's intention to watch it again. */
export interface SeasonTracking {
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rewatches: Viewing[];
  /** The user asked to watch the season again; cleared when the pass it asked for completes. */
  wantsRewatch: boolean;
  /** The status and dates the season had before its first episode viewing, restored when the last one is removed. */
  manual?: ManualTracking | null;
}
