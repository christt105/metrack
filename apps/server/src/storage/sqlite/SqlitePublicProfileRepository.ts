import type { DatabaseSync } from 'node:sqlite';
import { normalizeHandle, type PublicPage } from '@metrack/domain';
import { HandleTakenError } from '../HandleTakenError.js';
import type { PublicProfileRepository } from '../repositories/PublicProfileRepository.js';
import { text } from './rowMapping.js';

export class SqlitePublicProfileRepository implements PublicProfileRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(userId: number): Promise<PublicPage> {
    const row = this.db
      .prepare(
        `SELECT u.handle, COALESCE(s.public_page, 0) AS public_page
         FROM user u LEFT JOIN user_setting s ON s.user_id = u.id
         WHERE u.id = ?`,
      )
      .get(userId);
    return { handle: text(row?.handle), enabled: Number(row?.public_page ?? 0) === 1 };
  }

  async findByHandle(handle: string): Promise<{ userId: number; enabled: boolean } | undefined> {
    const row = this.db
      .prepare(
        `SELECT u.id, COALESCE(s.public_page, 0) AS public_page
         FROM user u LEFT JOIN user_setting s ON s.user_id = u.id
         WHERE u.handle = ? COLLATE NOCASE`,
      )
      .get(normalizeHandle(handle));
    return row ? { userId: Number(row.id), enabled: Number(row.public_page) === 1 } : undefined;
  }

  async save(userId: number, page: PublicPage): Promise<void> {
    try {
      this.db
        .prepare('UPDATE user SET handle = ? WHERE id = ?')
        .run(page.handle === null ? null : normalizeHandle(page.handle), userId);
      this.db
        .prepare(
          `INSERT INTO user_setting (user_id, public_page) VALUES (?, ?)
           ON CONFLICT (user_id) DO UPDATE SET public_page = excluded.public_page`,
        )
        .run(userId, page.enabled ? 1 : 0);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE') && page.handle !== null) {
        throw new HandleTakenError(page.handle);
      }
      throw error;
    }
  }
}
