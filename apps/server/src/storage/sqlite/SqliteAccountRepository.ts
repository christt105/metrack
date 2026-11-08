import type { DatabaseSync } from 'node:sqlite';
import { OWNER_ID } from '../../users/OWNER_ID.js';
import type { AccountRepository } from '../repositories/AccountRepository.js';

const OWNABLE_TABLES = ['movie', 'series', 'videogame', 'book'];

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: DatabaseSync) {}

  async deletionRequestedAt(userId: number): Promise<string | null> {
    const row = this.db.prepare('SELECT deletion_requested_at FROM user WHERE id = ?').get(userId);
    return row?.deletion_requested_at == null ? null : String(row.deletion_requested_at);
  }

  async requestDeletion(userId: number, requestedAt: string): Promise<string> {
    this.db
      .prepare(
        'UPDATE user SET deletion_requested_at = ? WHERE id = ? AND deletion_requested_at IS NULL',
      )
      .run(requestedAt, userId);
    return (await this.deletionRequestedAt(userId)) ?? requestedAt;
  }

  async cancelDeletion(userId: number): Promise<boolean> {
    const result = this.db
      .prepare(
        'UPDATE user SET deletion_requested_at = NULL WHERE id = ? AND deletion_requested_at IS NOT NULL',
      )
      .run(userId);
    return Number(result.changes) > 0;
  }

  async dueForDeletion(requestedAtOrBefore: string): Promise<number[]> {
    return this.db
      .prepare(
        `SELECT id FROM user WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at <= ?
           AND id <> ? ORDER BY id`,
      )
      .all(requestedAtOrBefore, OWNER_ID)
      .map((row) => Number(row.id));
  }

  async erase(userId: number): Promise<string[]> {
    if (userId === OWNER_ID) throw new Error('The owner account cannot be deleted');
    this.db.exec('SAVEPOINT erase_account');
    try {
      const hashes = this.db
        .prepare('SELECT hash FROM image_owner WHERE user_id = ? ORDER BY hash')
        .all(userId)
        .map((row) => String(row.hash));
      const held = (table: string): number[] =>
        this.db
          .prepare(`SELECT ${table}_id AS id FROM ${table}_entry WHERE user_id = ?`)
          .all(userId)
          .map((row) => Number(row.id));
      const series = held('series');
      const others = (['movie', 'videogame', 'book'] as const).map((table) => ({
        table,
        ids: held(table),
      }));
      for (const table of OWNABLE_TABLES) {
        this.db
          .prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ?`)
          .run(OWNER_ID, userId);
      }
      this.db.prepare('DELETE FROM user WHERE id = ?').run(userId);
      this.dropUnusedSeries(series);
      for (const { table, ids } of others) {
        for (const id of ids) {
          this.db
            .prepare(
              `DELETE FROM ${table} WHERE id = ? AND owner_id IS NULL
                 AND NOT EXISTS (SELECT 1 FROM ${table}_entry WHERE ${table}_id = ?)`,
            )
            .run(id, id);
        }
      }
      this.db.exec('RELEASE erase_account');
      return hashes;
    } catch (error) {
      this.db.exec('ROLLBACK TO erase_account');
      this.db.exec('RELEASE erase_account');
      throw error;
    }
  }

  private dropUnusedSeries(ids: number[]): void {
    for (const id of ids) {
      this.db
        .prepare(
          `DELETE FROM series WHERE id = ? AND owner_id IS NULL
             AND NOT EXISTS (SELECT 1 FROM series_entry WHERE series_id = ?)
             AND NOT EXISTS (
               SELECT 1 FROM season_entry
               WHERE season_id IN (SELECT id FROM season WHERE series_id = ?)
             )`,
        )
        .run(id, id, id);
    }
  }
}
