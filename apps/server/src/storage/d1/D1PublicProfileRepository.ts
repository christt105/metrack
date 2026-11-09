import { normalizeHandle, type PublicPage } from '@metrack/domain';
import { HandleTakenError } from '../HandleTakenError.js';
import {
  PUBLIC_PAGE_SQL,
  SAVE_PUBLIC_PAGE_SQL,
  publicPageFromRow,
  publicPageParams,
} from '../mapping/publicPageRows.js';
import type { PublicProfileRepository } from '../repositories/PublicProfileRepository.js';
import type { D1Database } from './D1Database.js';
import { queryFirst, statement } from './d1Query.js';

export class D1PublicProfileRepository implements PublicProfileRepository {
  constructor(private readonly db: D1Database) {}

  async get(userId: number): Promise<PublicPage> {
    return publicPageFromRow(await queryFirst(this.db, PUBLIC_PAGE_SQL, userId));
  }

  async findByHandle(handle: string): Promise<{ userId: number; enabled: boolean } | undefined> {
    const row = await queryFirst(
      this.db,
      `SELECT u.id, COALESCE(s.public_page, 0) AS public_page
         FROM user u LEFT JOIN user_setting s ON s.user_id = u.id
         WHERE u.handle = ? COLLATE NOCASE`,
      normalizeHandle(handle),
    );
    return row ? { userId: Number(row.id), enabled: Number(row.public_page) === 1 } : undefined;
  }

  async save(userId: number, page: PublicPage): Promise<void> {
    try {
      await this.db.batch([
        statement(this.db, 'UPDATE user SET handle = ? WHERE id = ?', [
          page.handle === null ? null : normalizeHandle(page.handle),
          userId,
        ]),
        statement(this.db, SAVE_PUBLIC_PAGE_SQL, publicPageParams(userId, page)),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE') && page.handle !== null) {
        throw new HandleTakenError(page.handle);
      }
      throw error;
    }
  }
}
