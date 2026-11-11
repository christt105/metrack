import type { ContentVersions } from '../../site/ContentVersions.js';
import type { D1Database } from './D1Database.js';
import { execute } from './d1Query.js';

export class D1ContentVersions implements ContentVersions {
  constructor(private readonly db: D1Database) {}

  async bump(userId: number): Promise<void> {
    await execute(
      this.db,
      'UPDATE user SET content_version = content_version + 1 WHERE id = ?',
      userId,
    );
  }
}
