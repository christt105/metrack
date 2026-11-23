import type { MediaStatus } from './MediaStatus.js';

/** What a season held before its episodes first had a viewing: the status and dates the user left it with. */
export interface ManualTracking {
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
}
