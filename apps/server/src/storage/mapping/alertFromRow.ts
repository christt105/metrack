import type { AlertKey, AlertKind, AlertSubjectType, ReleaseAlert } from '@metrack/domain';
import type { Row } from './Row.js';

export function alertKeyFromRow(row: Row): AlertKey {
  return {
    subjectType: row.subject_type as AlertSubjectType,
    subjectId: Number(row.subject_id),
    kind: row.kind as AlertKind,
  };
}

export function alertFromRow(row: Row): ReleaseAlert {
  return {
    id: Number(row.id),
    ...alertKeyFromRow(row),
    title: String(row.title),
    message: String(row.message),
    sentAt: String(row.sent_at),
  };
}
