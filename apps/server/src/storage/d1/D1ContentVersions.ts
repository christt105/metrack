import type { ContentVersions } from '../../site/ContentVersions.js';
import type { D1Database } from './D1Database.js';
import { execute, queryFirst } from './d1Query.js';

export class D1ContentVersions implements ContentVersions {
  constructor(private readonly db: D1Database) {}

  async bump(userId: number): Promise<void> {
    await execute(
      this.db,
      'UPDATE user SET content_version = content_version + 1 WHERE id = ?',
      userId,
    );
  }

  async current(userId: number): Promise<number> {
    const row = await queryFirst(this.db, 'SELECT content_version FROM user WHERE id = ?', userId);
    return Number(row?.content_version ?? 0);
  }
}
