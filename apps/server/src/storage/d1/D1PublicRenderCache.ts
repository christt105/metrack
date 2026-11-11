import { normalizeHandle } from '@metrack/domain';
import type { PublicRenderCache } from '../../site/PublicRenderCache.js';
import type { PublicRenderLookup } from '../../site/PublicRenderLookup.js';
import type { D1Database } from './D1Database.js';
import { execute, queryFirst } from './d1Query.js';

/** How long a stored render counts as fresh, so changes the version cannot see (shared catalog rows, the year) show up within a day. */
export const RENDER_MAX_AGE_SECONDS = 24 * 3600;

/** Keeps rendered public pages in the `public_render` table of D1, one row per user and page. */
export class D1PublicRenderCache implements PublicRenderCache {
  constructor(
    private readonly db: D1Database,
    private readonly now: () => Date = () => new Date(),
    private readonly maxAgeSeconds = RENDER_MAX_AGE_SECONDS,
  ) {}

  async lookup(handle: string, cacheKey: string): Promise<PublicRenderLookup | undefined> {
    const row = await queryFirst(
      this.db,
      `SELECT u.id, COALESCE(s.public_page, 0) AS public_page, u.content_version,
              r.version AS render_version, r.rendered_at, r.content_type, r.body
         FROM user u
         LEFT JOIN user_setting s ON s.user_id = u.id
         LEFT JOIN public_render r ON r.user_id = u.id AND r.cache_key = ?
         WHERE u.handle = ? COLLATE NOCASE`,
      cacheKey,
      normalizeHandle(handle),
    );
    if (!row) return undefined;
    const version = Number(row.content_version);
    const fresh =
      row.render_version !== null &&
      Number(row.render_version) === version &&
      this.seconds() - Number(row.rendered_at) < this.maxAgeSeconds;
    return {
      userId: Number(row.id),
      enabled: Number(row.public_page) === 1,
      version,
      cached: fresh
        ? {
            contentType: String(row.content_type),
            body: String(row.body),
            renderedAt: Number(row.rendered_at),
          }
        : null,
    };
  }

  async store(
    userId: number,
    cacheKey: string,
    version: number,
    contentType: string,
    body: string,
  ): Promise<number> {
    const renderedAt = this.seconds();
    await execute(
      this.db,
      'INSERT OR REPLACE INTO public_render (user_id, cache_key, version, rendered_at, content_type, body) VALUES (?, ?, ?, ?, ?, ?)',
      userId,
      cacheKey,
      version,
      renderedAt,
      contentType,
      body,
    );
    return renderedAt;
  }

  private seconds(): number {
    return Math.floor(this.now().getTime() / 1000);
  }
}
