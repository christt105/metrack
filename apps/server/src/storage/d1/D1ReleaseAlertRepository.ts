import type { AlertKey, AlertSubjectType, ReleaseAlert } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { alertFromRow, alertKeyFromRow } from '../mapping/alertFromRow.js';
import type { NewReleaseAlert } from '../repositories/NewReleaseAlert.js';
import type { ReleaseAlertRepository } from '../repositories/ReleaseAlertRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll } from './d1Query.js';

export class D1ReleaseAlertRepository implements ReleaseAlertRepository {
  constructor(
    private readonly db: D1Database,
    private readonly scope: UserScope,
  ) {}

  async record(alert: NewReleaseAlert): Promise<boolean> {
    const meta = await execute(
      this.db,
      `INSERT OR IGNORE INTO release_alert (user_id, subject_type, subject_id, kind, title, message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      this.scope.userId(),
      alert.subjectType,
      alert.subjectId,
      alert.kind,
      alert.title,
      alert.message,
      alert.sentAt,
    );
    return meta.changes > 0;
  }

  async keysFor(subjectType: AlertSubjectType, subjectId: number): Promise<AlertKey[]> {
    const rows = await queryAll(
      this.db,
      'SELECT subject_type, subject_id, kind FROM release_alert WHERE user_id = ? AND subject_type = ? AND subject_id = ?',
      this.scope.userId(),
      subjectType,
      subjectId,
    );
    return rows.map(alertKeyFromRow);
  }

  async allKeys(): Promise<AlertKey[]> {
    const rows = await queryAll(
      this.db,
      'SELECT subject_type, subject_id, kind FROM release_alert WHERE user_id = ?',
      this.scope.userId(),
    );
    return rows.map(alertKeyFromRow);
  }

  async list(limit = 100): Promise<ReleaseAlert[]> {
    const rows = await queryAll(
      this.db,
      'SELECT * FROM release_alert WHERE user_id = ? ORDER BY sent_at DESC, id DESC LIMIT ?',
      this.scope.userId(),
      limit,
    );
    return rows.map(alertFromRow);
  }
}
