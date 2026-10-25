import { MEDIA_STATUSES, canTransition } from '@metrack/domain';
import type { MediaStatus } from '@metrack/domain';

/** The current status followed by every status the domain rules allow next. */
export function statusOptions(current: MediaStatus): MediaStatus[] {
  return MEDIA_STATUSES.filter((status) => status === current || canTransition(current, status));
}
