import type { Tracking } from '@metrack/domain';
import { DateValue } from './renderFrontmatter.js';
import { statusKey } from './statusKey.js';

/** The front matter fields every tracked page shares. */
export function trackingFields(tracking: Tracking): Record<string, unknown> {
  return {
    status: statusKey(tracking.status),
    date: tracking.finishedAt === null ? null : new DateValue(tracking.finishedAt),
    rating: tracking.rating === null ? null : String(tracking.rating),
    rewatches: tracking.rewatches.map((date) => new DateValue(date)),
    pending_review: tracking.pendingReview || null,
  };
}
