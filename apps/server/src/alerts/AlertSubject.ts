import type { AlertSubjectType } from '@metrack/domain';

/** The movie or season an alert is about. */
export interface AlertSubject {
  subjectType: AlertSubjectType;
  subjectId: number;
}
