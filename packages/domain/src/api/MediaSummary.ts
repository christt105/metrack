import type { MediaStatus } from '../MediaStatus.js';
import type { MediaType } from '../MediaType.js';

/**
 * One row of the combined list. Series carry no tracking of their own, so their `status`, `rating`
 * and dates are null and `seasonCount` is set; seasons carry their series in `seriesId` and `seriesTitle`.
 * A series is `pendingReview` when any of its seasons is.
 */
export interface MediaSummary {
  type: MediaType;
  id: number;
  title: string;
  subtitle: string | null;
  releaseDate: string | null;
  cover: string | null;
  status: MediaStatus | null;
  rating: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  seriesId: number | null;
  seriesTitle: string | null;
  seasonCount: number | null;
  pendingReview: boolean;
}
