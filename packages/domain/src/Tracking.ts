import type { MediaStatus } from './MediaStatus.js';

/** Personal tracking data. Dates are ISO `YYYY-MM-DD`, rating is 0 to 10. */
export interface Tracking {
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
  rewatches: string[];
}
