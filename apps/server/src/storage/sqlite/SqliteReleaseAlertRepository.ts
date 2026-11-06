import type { DatabaseSync } from 'node:sqlite';
import type { AlertKey, AlertKind, AlertSubjectType, ReleaseAlert } from '@metrack/domain';
import type { NewReleaseAlert } from '../repositories/NewReleaseAlert.js';
import type { ReleaseAlertRepository } from '../repositories/ReleaseAlertRepository.js';

export class SqliteReleaseAlertRepository implements ReleaseAlertRepository {
  constructor(private readonly db: DatabaseSync) {}

  async record(alert: NewReleaseAlert): Promise<boolean> {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO release_alert (subject_type, subject_id, kind, title, message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
        'SELECT subject_type, subject_id, kind FROM release_alert WHERE subject_type = ? AND subject_id = ?',
      )
      .all(subjectType, subjectId)
      .map((row) => ({
        subjectType: row.subject_type as AlertSubjectType,
        subjectId: Number(row.subject_id),
        kind: row.kind as AlertKind,
      }));
  }

  async list(limit = 100): Promise<ReleaseAlert[]> {
    return this.db
      .prepare('SELECT * FROM release_alert ORDER BY sent_at DESC, id DESC LIMIT ?')
      .all(limit)
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
