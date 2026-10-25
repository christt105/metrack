import type { AlertSubjectType } from './AlertSubjectType.js';
import { availabilityWindowDays } from './availabilityWindowDays.js';
import { daysBetween } from './dayMath.js';

export const FREQUENT_CHECK_MINUTES = 30;
export const WAITING_CHECK_MINUTES = 180;
export const IDLE_CHECK_MINUTES = 720;

/**
 * How long to wait before asking the provider about a title again. Around the release (the day before
 * until the day after) it is asked every 30 minutes so a premiere is never reported a day late; while
 * providers may still be catching up it is asked every 3 hours; otherwise twice a day.
 */
export function checkIntervalMinutes(
  subjectType: AlertSubjectType,
  releaseDate: string | null,
  today: string,
): number {
  if (releaseDate === null) return IDLE_CHECK_MINUTES;
  const untilRelease = daysBetween(today, releaseDate);
  if (untilRelease >= -1 && untilRelease <= 1) return FREQUENT_CHECK_MINUTES;
  if (untilRelease < 0 && -untilRelease <= availabilityWindowDays(subjectType)) {
    return WAITING_CHECK_MINUTES;
  }
  return IDLE_CHECK_MINUTES;
}
