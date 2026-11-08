import type { GiscusConfig, PublicPage } from '@metrack/domain';
import type { Row } from './Row.js';
import { text } from './rowMapping.js';

/** Reads the profile columns of one user by id; the row is missing when the user does not exist. */
export const PUBLIC_PAGE_SQL = `SELECT u.handle, COALESCE(s.public_page, 0) AS public_page, s.public_avatar, s.public_intro,
                s.public_description, s.public_about, s.giscus_repo, s.giscus_repo_id, s.giscus_category,
                s.giscus_category_id
         FROM user u LEFT JOIN user_setting s ON s.user_id = u.id
         WHERE u.id = ?`;

/** Writes the profile columns of one user, binding the values of `publicPageParams`. */
export const SAVE_PUBLIC_PAGE_SQL = `INSERT INTO user_setting
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
             giscus_category_id = excluded.giscus_category_id`;

export function publicPageFromRow(row: Row | undefined): PublicPage {
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

export function publicPageParams(userId: number, page: PublicPage): (string | number | null)[] {
  return [
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
  ];
}

function giscusOf(row: Row | undefined): GiscusConfig | null {
  const repo = text(row?.giscus_repo);
  const repoId = text(row?.giscus_repo_id);
  const category = text(row?.giscus_category);
  const categoryId = text(row?.giscus_category_id);
  return repo && repoId && category && categoryId ? { repo, repoId, category, categoryId } : null;
}
