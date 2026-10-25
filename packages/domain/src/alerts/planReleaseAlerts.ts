import type { AlertCandidate } from './AlertCandidate.js';
import type { AlertKey } from './AlertKey.js';
import { availabilityWindowDays } from './availabilityWindowDays.js';
import { daysBetween } from './dayMath.js';

/**
 * The alerts that are due on `today` (`YYYY-MM-DD`) and have not been sent. "Tomorrow" and "today"
 * only fire on their exact day, so a stale warning is never sent late.
 */
export function planReleaseAlerts(
  candidates: readonly AlertCandidate[],
  sent: readonly AlertKey[],
  today: string,
): AlertKey[] {
  const wasSent = (key: AlertKey): boolean =>
    sent.some(
      (s) =>
        s.subjectType === key.subjectType && s.subjectId === key.subjectId && s.kind === key.kind,
    );
  const due: AlertKey[] = [];
  for (const candidate of candidates) {
    const { subjectType, subjectId, releaseDate } = candidate;
    if (releaseDate === null) continue;
    const untilRelease = daysBetween(today, releaseDate);
    const add = (kind: AlertKey['kind']): void => {
      const key = { subjectType, subjectId, kind };
      if (!wasSent(key)) due.push(key);
    };
    if (untilRelease === 1) add('releases_tomorrow');
    if (untilRelease === 0) add('releases_today');
    if (
      candidate.flatrateEs &&
      untilRelease <= 0 &&
      -untilRelease <= availabilityWindowDays(subjectType)
    ) {
      add('available_es');
    }
  }
  return due;
}
