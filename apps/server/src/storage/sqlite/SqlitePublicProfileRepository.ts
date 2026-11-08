import type { DatabaseSync } from 'node:sqlite';
import { normalizeHandle, type GiscusConfig, type PublicPage } from '@metrack/domain';
import { HandleTakenError } from '../HandleTakenError.js';
import type { PublicProfileRepository } from '../repositories/PublicProfileRepository.js';
import type { Row } from './Row.js';
import { text } from './rowMapping.js';

export class SqlitePublicProfileRepository implements PublicProfileRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(userId: number): Promise<PublicPage> {
    const row = this.db
      .prepare(
        `SELECT u.handle, COALESCE(s.public_page, 0) AS public_page, s.public_avatar, s.public_intro,
                s.public_description, s.public_about, s.giscus_repo, s.giscus_repo_id, s.giscus_category,
                s.giscus_category_id
         FROM user u LEFT JOIN user_setting s ON s.user_id = u.id
         WHERE u.id = ?`,
      )
      .get(userId);
    return {
      handle: text(row?.handle),
      enabled: Number(row?.public_page ?? 0) === 1,
      avatar: text(row?.public_avatar),
      intro: text(row?.public_intro),
      description: text(row?.public_description),
      about: text(row?.public_about),
      giscus: giscusOf(row),
    };
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
          `INSERT INTO user_setting
             (user_id, public_page, public_avatar, public_intro, public_description, public_about,
              giscus_repo, giscus_repo_id, giscus_category, giscus_category_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id) DO UPDATE SET
             public_page = excluded.public_page,
             public_avatar = excluded.public_avatar,
             public_intro = excluded.public_intro,
             public_description = excluded.public_description,
             public_about = excluded.public_about,
             giscus_repo = excluded.giscus_repo,
             giscus_repo_id = excluded.giscus_repo_id,
             giscus_category = excluded.giscus_category,
             giscus_category_id = excluded.giscus_category_id`,
        )
        .run(
          userId,
          page.enabled ? 1 : 0,
          page.avatar,
          page.intro,
          page.description,
          page.about,
          page.giscus?.repo ?? null,
          page.giscus?.repoId ?? null,
          page.giscus?.category ?? null,
          page.giscus?.categoryId ?? null,
        );
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE') && page.handle !== null) {
        throw new HandleTakenError(page.handle);
      }
      throw error;
    }
  }
}

function giscusOf(row: Row | undefined): GiscusConfig | null {
  const repo = text(row?.giscus_repo);
  const repoId = text(row?.giscus_repo_id);
  const category = text(row?.giscus_category);
  const categoryId = text(row?.giscus_category_id);
  return repo && repoId && category && categoryId ? { repo, repoId, category, categoryId } : null;
}
