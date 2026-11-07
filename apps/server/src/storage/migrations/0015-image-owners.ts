import { isLinkedImageUrl } from '@metrack/domain';
import { isProviderImageUrl } from '../../images/isProviderImageUrl.js';
import type { Migration } from '../Migration.js';

const IMAGE_COLUMNS: { table: string; column: string }[] = [
  { table: 'movie', column: 'cover' },
  { table: 'movie', column: 'banner' },
  { table: 'series', column: 'cover' },
  { table: 'series', column: 'banner' },
  { table: 'season', column: 'cover' },
  { table: 'season', column: 'banner' },
  { table: 'videogame', column: 'cover' },
  { table: 'videogame', column: 'banner' },
  { table: 'book', column: 'cover' },
];

/**
 * Records who owns each image that no provider gave (uploads, URLs of any site, files from the vault), so
 * they count for that user's quota; every existing one goes to the owner. Covers and banners copied from a
 * linked provider (TMDB, Steam, IGDB) point at the provider URL again, and the stored copy stays as an archive.
 */
export const imageOwnersMigration: Migration = {
  version: 15,
  name: 'image-owners',
  up: (db) => {
    db.exec(`
      CREATE TABLE image_owner (
        hash TEXT NOT NULL REFERENCES image (hash) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (hash, user_id)
      );

      CREATE INDEX image_owner_user ON image_owner (user_id);
    `);
    const images = db.prepare('SELECT hash, source_url, created_at FROM image').all() as {
      hash: string;
      source_url: string | null;
      created_at: string;
    }[];
    const hasOwner = db.prepare('SELECT 1 FROM user WHERE id = 1').get() !== undefined;
    const own = db.prepare('INSERT INTO image_owner (hash, user_id, created_at) VALUES (?, 1, ?)');
    for (const image of images) {
      const ref = `/api/images/${image.hash}`;
      if (image.source_url !== null && isLinkedImageUrl(image.source_url)) {
        for (const { table, column } of IMAGE_COLUMNS) {
          db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(
            image.source_url,
            ref,
          );
          db.prepare(
            `UPDATE ${table}_entry SET overrides = json_set(overrides, '$.${column}', ?)
             WHERE json_extract(overrides, '$.${column}') = ?`,
          ).run(image.source_url, ref);
        }
      } else if (hasOwner && !isProviderImageUrl(image.source_url)) {
        own.run(image.hash, image.created_at);
      }
    }
  },
};
