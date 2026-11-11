import { normalizeHandle } from '@metrack/domain';
import type { PublicRenderCache } from '../../site/PublicRenderCache.js';
import type { PublicRenderLookup } from '../../site/PublicRenderLookup.js';
import type { D1Database } from './D1Database.js';
import { execute, queryFirst } from './d1Query.js';

/** Keeps rendered public pages in the `public_render` table of D1, one row per user and page. */
export class D1PublicRenderCache implements PublicRenderCache {
  constructor(private readonly db: D1Database) {}

  async lookup(handle: string, cacheKey: string): Promise<PublicRenderLookup | undefined> {
    const row = await queryFirst(
      this.db,
      `SELECT u.id, COALESCE(s.public_page, 0) AS public_page, u.content_version,
              r.version AS render_version, r.content_type, r.body
         FROM user u
         LEFT JOIN user_setting s ON s.user_id = u.id
         LEFT JOIN public_render r ON r.user_id = u.id AND r.cache_key = ?
         WHERE u.handle = ? COLLATE NOCASE`,
      cacheKey,
      normalizeHandle(handle),
    );
    if (!row) return undefined;
    const version = Number(row.content_version);
    const fresh = row.render_version !== null && Number(row.render_version) === version;
    return {
      userId: Number(row.id),
      enabled: Number(row.public_page) === 1,
      version,
      cached: fresh ? { contentType: String(row.content_type), body: String(row.body) } : null,
    };
  }

  async store(
    userId: number,
    cacheKey: string,
    version: number,
    contentType: string,
    body: string,
  ): Promise<void> {
    await execute(
      this.db,
      'INSERT OR REPLACE INTO public_render (user_id, cache_key, version, content_type, body) VALUES (?, ?, ?, ?, ?)',
      userId,
      cacheKey,
      version,
      contentType,
      body,
    );
  }
}
