import type { MediaStatus } from './MediaStatus.js';
import type { Viewing } from './Viewing.js';

/**
 * Personal tracking data. Dates are ISO `YYYY-MM-DD`, `rewatches` lists the viewings after the first (see `normalizeViewings`), rating is an integer from 1 (worst) to 7 (best), see `RATING_LEVELS`. `pendingReview` marks a viewing the
 * Jellyfin sync recorded and the owner has not confirmed yet; the published feeds leave it out until then.
 */
export interface Tracking {
  status: MediaStatus;
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
  rewatches: Viewing[];
  pendingReview: boolean;
}
