import type { DatabaseSync } from 'node:sqlite';
import { IMAGE_COLUMNS } from '../../images/imageColumns.js';
import { imageRef } from '../../images/imageRef.js';
import type { StoredImage } from '../../images/StoredImage.js';
import type { ImageRepository } from '../repositories/ImageRepository.js';
import type { Row } from './Row.js';

const REVIEW_TABLES = [
  'movie_entry',
  'series_entry',
  'season_entry',
  'videogame_entry',
  'book_entry',
];

export class SqliteImageRepository implements ImageRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(hash: string): Promise<StoredImage | undefined> {
    const row = this.db.prepare('SELECT * FROM image WHERE hash = ?').get(hash);
    return row ? toImage(row) : undefined;
  }

  async list(): Promise<StoredImage[]> {
    return this.db
      .prepare('SELECT * FROM image ORDER BY created_at, hash')
      .all()
      .map((row) => toImage(row));
  }

  async insert(image: StoredImage): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO image (hash, extension, mime_type, width, height, byte_size, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (hash) DO NOTHING`,
      )
      .run(
        image.hash,
        image.extension,
        image.mimeType,
        image.width,
        image.height,
        image.byteSize,
        image.sourceUrl,
        image.createdAt,
      );
  }

  async addSource(url: string, hash: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO image_source (url, hash) VALUES (?, ?)
         ON CONFLICT (url) DO UPDATE SET hash = excluded.hash`,
      )
      .run(url, hash);
  }

  async listSources(): Promise<{ url: string; hash: string }[]> {
    return this.db
      .prepare('SELECT url, hash FROM image_source ORDER BY url')
      .all()
      .map((row) => ({ url: String(row.url), hash: String(row.hash) }));
  }

  async findBySourceUrl(url: string): Promise<StoredImage | undefined> {
    const row = this.db
      .prepare(
        `SELECT * FROM image
         WHERE source_url = ? OR hash IN (SELECT hash FROM image_source WHERE url = ?)
         ORDER BY source_url = ? DESC
         LIMIT 1`,
      )
      .get(url, url, url);
    return row ? toImage(row) : undefined;
  }

  async delete(hash: string): Promise<void> {
    const ref = imageRef(hash);
    for (const { table, column } of IMAGE_COLUMNS) {
      this.db.prepare(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`).run(ref);
      this.db
        .prepare(
          `UPDATE ${table}_entry SET overrides = json_set(overrides, '$.${column}', NULL)
           WHERE json_extract(overrides, '$.${column}') = ?`,
        )
        .run(ref);
    }
    this.db.prepare('DELETE FROM image_owner WHERE hash = ?').run(hash);
    this.db.prepare('DELETE FROM image_source WHERE hash = ?').run(hash);
    this.db.prepare('DELETE FROM image WHERE hash = ?').run(hash);
  }

  async orphans(): Promise<string[]> {
    const referenced = IMAGE_COLUMNS.flatMap(({ table, column }) => [
      `SELECT ${column} AS ref FROM ${table} WHERE ${column} IS NOT NULL`,
      `SELECT json_extract(overrides, '$.${column}') AS ref FROM ${table}_entry
       WHERE json_extract(overrides, '$.${column}') IS NOT NULL`,
    ]).join(' UNION ');
    const embedded = REVIEW_TABLES.map(
      (table) =>
        `EXISTS (SELECT 1 FROM ${table} WHERE instr(review, '${imageRef('')}' || image.hash) > 0)`,
    ).join(' OR ');
    return this.db
      .prepare(
        `WITH referenced (ref) AS (${referenced})
         SELECT hash FROM image
         WHERE '${imageRef('')}' || hash NOT IN (SELECT ref FROM referenced)
           AND (source_url IS NULL OR source_url NOT IN (SELECT ref FROM referenced))
           AND NOT EXISTS (
             SELECT 1 FROM image_source
             WHERE image_source.hash = image.hash AND url IN (SELECT ref FROM referenced)
           )
           AND NOT (${embedded})
         ORDER BY hash`,
      )
      .all()
      .map((row) => String(row.hash));
  }

  async addOwner(hash: string, userId: number, createdAt: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO image_owner (hash, user_id, created_at) VALUES (?, ?, ?)
         ON CONFLICT (hash, user_id) DO NOTHING`,
      )
      .run(hash, userId, createdAt);
  }

  async ownerIds(hash: string): Promise<number[]> {
    return this.db
      .prepare('SELECT user_id FROM image_owner WHERE hash = ? ORDER BY user_id')
      .all(hash)
      .map((row) => Number(row.user_id));
  }

  async usedBytes(userId: number): Promise<number> {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(image.byte_size), 0) AS used FROM image_owner
         JOIN image ON image.hash = image_owner.hash
         WHERE image_owner.user_id = ?`,
      )
      .get(userId);
    return Number(row?.used ?? 0);
  }

  async isShownByCatalog(hash: string): Promise<boolean> {
    const ref = imageRef(hash);
    return IMAGE_COLUMNS.some(
      ({ table, column }) =>
        this.db
          .prepare(`SELECT 1 FROM ${table} WHERE ${column} = ? AND ${ownerFilter(table)} LIMIT 1`)
          .get(ref) !== undefined,
    );
  }
}

function ownerFilter(table: string): string {
  return table === 'season'
    ? 'series_id IN (SELECT id FROM series WHERE owner_id IS NULL)'
    : 'owner_id IS NULL';
}

function toImage(row: Row): StoredImage {
  const hash = String(row.hash);
  return {
    hash,
    ref: imageRef(hash),
    extension: String(row.extension),
    mimeType: String(row.mime_type),
    width: Number(row.width),
    height: Number(row.height),
    byteSize: Number(row.byte_size),
    sourceUrl: row.source_url === null ? null : String(row.source_url),
    createdAt: String(row.created_at),
  };
}
