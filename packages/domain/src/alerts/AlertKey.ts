import type { AlertKind } from './AlertKind.js';
import type { AlertSubjectType } from './AlertSubjectType.js';

/** Identifies one alert. Each key is sent at most once. */
export interface AlertKey {
  subjectType: AlertSubjectType;
  subjectId: number;
  kind: AlertKind;
}
