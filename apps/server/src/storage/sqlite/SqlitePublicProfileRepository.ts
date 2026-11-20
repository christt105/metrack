import type { DatabaseSync } from 'node:sqlite';
import { normalizeHandle, type Language, type PublicPage } from '@metrack/domain';
import { HandleTakenError } from '../HandleTakenError.js';
import type { PublicProfileRepository } from '../repositories/PublicProfileRepository.js';
import {
  PUBLIC_PAGE_SQL,
  SAVE_PUBLIC_PAGE_SQL,
  publicPageFromRow,
  publicPageParams,
} from '../mapping/publicPageRows.js';

export class SqlitePublicProfileRepository implements PublicProfileRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(userId: number): Promise<PublicPage> {
    const row = this.db.prepare(PUBLIC_PAGE_SQL).get(userId);
    return publicPageFromRow(row);
  }

  async findByHandle(
    handle: string,
  ): Promise<{ userId: number; enabled: boolean; language: Language | null } | undefined> {
    const row = this.db
      .prepare(
        `SELECT u.id, COALESCE(s.public_page, 0) AS public_page, s.language
         FROM user u LEFT JOIN user_setting s ON s.user_id = u.id
         WHERE u.handle = ? COLLATE NOCASE`,
      )
      .get(normalizeHandle(handle));
    return row
      ? {
          userId: Number(row.id),
          enabled: Number(row.public_page) === 1,
          language: row.language === 'en' || row.language === 'es' ? row.language : null,
        }
      : undefined;
  }

  async save(userId: number, page: PublicPage): Promise<void> {
    try {
      this.db
        .prepare('UPDATE user SET handle = ? WHERE id = ?')
        .run(page.handle === null ? null : normalizeHandle(page.handle), userId);
      this.db.prepare(SAVE_PUBLIC_PAGE_SQL).run(...publicPageParams(userId, page));
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE') && page.handle !== null) {
        throw new HandleTakenError(page.handle);
      }
      throw error;
    }
  }
}
