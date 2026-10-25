import type { AlertSubjectType } from './AlertSubjectType.js';

/**
 * How many days after its release a title can still trigger `available_es`. Older titles are not
 * announced, so following a series does not alert about a season that has been out for months.
 */
export function availabilityWindowDays(subjectType: AlertSubjectType): number {
  return subjectType === 'movie' ? 60 : 14;
}
