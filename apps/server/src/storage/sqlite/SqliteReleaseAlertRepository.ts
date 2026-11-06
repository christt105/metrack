import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { AlertKey, AlertKind, AlertSubjectType, ReleaseAlert } from '@metrack/domain';
import type { NewReleaseAlert } from '../repositories/NewReleaseAlert.js';
import type { ReleaseAlertRepository } from '../repositories/ReleaseAlertRepository.js';

export class SqliteReleaseAlertRepository implements ReleaseAlertRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly scope: UserScope,
  ) {}

  async record(alert: NewReleaseAlert): Promise<boolean> {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO release_alert (user_id, subject_type, subject_id, kind, title, message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        this.scope.userId(),
        alert.subjectType,
        alert.subjectId,
        alert.kind,
        alert.title,
        alert.message,
        alert.sentAt,
      );
    return Number(result.changes) > 0;
  }

  async keysFor(subjectType: AlertSubjectType, subjectId: number): Promise<AlertKey[]> {
    return this.db
      .prepare(
        'SELECT subject_type, subject_id, kind FROM release_alert WHERE user_id = ? AND subject_type = ? AND subject_id = ?',
      )
      .all(this.scope.userId(), subjectType, subjectId)
      .map((row) => ({
        subjectType: row.subject_type as AlertSubjectType,
        subjectId: Number(row.subject_id),
        kind: row.kind as AlertKind,
      }));
  }

  async list(limit = 100): Promise<ReleaseAlert[]> {
    return this.db
      .prepare(
        'SELECT * FROM release_alert WHERE user_id = ? ORDER BY sent_at DESC, id DESC LIMIT ?',
      )
      .all(this.scope.userId(), limit)
      .map((row) => ({
        id: Number(row.id),
        subjectType: row.subject_type as AlertSubjectType,
        subjectId: Number(row.subject_id),
        kind: row.kind as AlertKind,
        title: String(row.title),
        message: String(row.message),
        sentAt: String(row.sent_at),
      }));
  }
}
