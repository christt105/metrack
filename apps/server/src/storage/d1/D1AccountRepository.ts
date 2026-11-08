import { OWNER_ID } from '../../users/OWNER_ID.js';
import type { AccountRepository } from '../repositories/AccountRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll, queryFirst, statement } from './d1Query.js';

const OWNABLE_TABLES = ['movie', 'series', 'videogame', 'book'];

export class D1AccountRepository implements AccountRepository {
  constructor(private readonly db: D1Database) {}

  async deletionRequestedAt(userId: number): Promise<string | null> {
    const row = await queryFirst(
      this.db,
      'SELECT deletion_requested_at FROM user WHERE id = ?',
      userId,
    );
    return row?.deletion_requested_at == null ? null : String(row.deletion_requested_at);
  }

  async requestDeletion(userId: number, requestedAt: string): Promise<string> {
    await execute(
      this.db,
      'UPDATE user SET deletion_requested_at = ? WHERE id = ? AND deletion_requested_at IS NULL',
      requestedAt,
      userId,
    );
    return (await this.deletionRequestedAt(userId)) ?? requestedAt;
  }

  async cancelDeletion(userId: number): Promise<boolean> {
    const meta = await execute(
      this.db,
      'UPDATE user SET deletion_requested_at = NULL WHERE id = ? AND deletion_requested_at IS NOT NULL',
      userId,
    );
    return meta.changes > 0;
  }

  /** Scans every account for pending deletions; run it from a scheduled job, never per request. */
  async dueForDeletion(requestedAtOrBefore: string): Promise<number[]> {
    const rows = await queryAll(
      this.db,
      `SELECT id FROM user WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at <= ?
           AND id <> ? ORDER BY id`,
      requestedAtOrBefore,
      OWNER_ID,
    );
    return rows.map((row) => Number(row.id));
  }

  /**
   * Erases the account in one `batch` of a fixed number of statements, however large the library is. The
   * owner reassignment scans the four catalog tables because they have no `owner_id` index.
   */
  async erase(userId: number): Promise<string[]> {
    if (userId === OWNER_ID) throw new Error('The owner account cannot be deleted');
    const hashes = (
      await queryAll(
        this.db,
        'SELECT hash FROM image_owner WHERE user_id = ? ORDER BY hash',
        userId,
      )
    ).map((row) => String(row.hash));
    await this.db.batch([
      ...OWNABLE_TABLES.map((table) =>
        statement(this.db, `UPDATE ${table} SET owner_id = ? WHERE owner_id = ?`, [
          OWNER_ID,
          userId,
        ]),
      ),
      statement(
        this.db,
        `DELETE FROM series WHERE owner_id IS NULL
           AND id IN (SELECT series_id FROM series_entry WHERE user_id = ?)
           AND NOT EXISTS (SELECT 1 FROM series_entry o WHERE o.series_id = series.id AND o.user_id <> ?)
           AND NOT EXISTS (
             SELECT 1 FROM season_entry o
             WHERE o.user_id <> ? AND o.season_id IN (SELECT id FROM season WHERE series_id = series.id)
           )`,
        [userId, userId, userId],
      ),
      ...['movie', 'videogame', 'book'].map((table) =>
        statement(
          this.db,
          `DELETE FROM ${table} WHERE owner_id IS NULL
             AND id IN (SELECT ${table}_id FROM ${table}_entry WHERE user_id = ?)
             AND NOT EXISTS (
               SELECT 1 FROM ${table}_entry o WHERE o.${table}_id = ${table}.id AND o.user_id <> ?
             )`,
          [userId, userId],
        ),
      ),
      statement(this.db, 'DELETE FROM user WHERE id = ?', [userId]),
    ]);
    return hashes;
  }
}
