import type { AlertKind } from './AlertKind.js';
import type { AlertSubjectType } from './AlertSubjectType.js';

/** An alert that was sent. `title` and `message` are the text of the notification. */
export interface ReleaseAlert {
  id: number;
  subjectType: AlertSubjectType;
  subjectId: number;
  kind: AlertKind;
  title: string;
  message: string;
  sentAt: string;
}
