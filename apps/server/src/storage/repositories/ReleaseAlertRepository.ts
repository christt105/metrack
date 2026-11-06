import type { AlertKey, AlertSubjectType, ReleaseAlert } from '@metrack/domain';
import type { NewReleaseAlert } from './NewReleaseAlert.js';

/** The alerts that were sent. A (subject, kind) pair can be recorded once. */
export interface ReleaseAlertRepository {
  /** Records the alert. Resolves to false when that subject and kind were already recorded. */
  record(alert: NewReleaseAlert): Promise<boolean>;
  keysFor(subjectType: AlertSubjectType, subjectId: number): Promise<AlertKey[]>;
  /** Newest first. */
  list(limit?: number): Promise<ReleaseAlert[]>;
}
