import { IMAGE_COLUMNS } from '../../images/imageColumns.js';
import { imageRef } from '../../images/imageRef.js';
import type { StoredImage } from '../../images/StoredImage.js';
import { imageFromRow } from '../mapping/imageFromRow.js';
import { REVIEW_TABLES, catalogShowsSql } from '../mapping/imageSql.js';
import type { ImageRepository } from '../repositories/ImageRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll, queryFirst, statement } from './d1Query.js';

export class D1ImageRepository implements ImageRepository {
  constructor(private readonly db: D1Database) {}

  async get(hash: string): Promise<StoredImage | undefined> {
    const row = await queryFirst(this.db, 'SELECT * FROM image WHERE hash = ?', hash);
    return row ? imageFromRow(row) : undefined;
  }

  /** Reads every stored image of every user; for maintenance jobs only, cache it (nr8fn1). */
  async list(): Promise<StoredImage[]> {
    const rows = await queryAll(this.db, 'SELECT * FROM image ORDER BY created_at, hash');
    return rows.map(imageFromRow);
  }

  async insert(image: StoredImage): Promise<void> {
    await execute(
      this.db,
      `INSERT INTO image (hash, extension, mime_type, width, height, byte_size, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (hash) DO NOTHING`,
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
    await execute(
      this.db,
      `INSERT INTO image_source (url, hash) VALUES (?, ?)
         ON CONFLICT (url) DO UPDATE SET hash = excluded.hash`,
      url,
      hash,
    );
  }

  /** Reads every recorded source URL; for maintenance jobs only, cache it (nr8fn1). */
  async listSources(): Promise<{ url: string; hash: string }[]> {
    const rows = await queryAll(this.db, 'SELECT url, hash FROM image_source ORDER BY url');
    return rows.map((row) => ({ url: String(row.url), hash: String(row.hash) }));
  }

  async findBySourceUrl(url: string): Promise<StoredImage | undefined> {
    const row = await queryFirst(
      this.db,
      `SELECT * FROM image
         WHERE source_url = ? OR hash IN (SELECT hash FROM image_source WHERE url = ?)
         ORDER BY source_url = ? DESC
         LIMIT 1`,
      url,
      url,
      url,
    );
    return row ? imageFromRow(row) : undefined;
  }

  /**
   * Clears every reference to the image in one `batch`. It scans the catalog and entry tables, which index
   * neither images nor overrides, so run it from a maintenance job, never per request.
   */
  async delete(hash: string): Promise<void> {
    const ref = imageRef(hash);
    await this.db.batch([
      ...IMAGE_COLUMNS.flatMap(({ table, column }) => [
        statement(this.db, `UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`, [ref]),
        statement(
          this.db,
          `UPDATE ${table}_entry SET overrides = json_set(overrides, '$.${column}', NULL)
           WHERE json_extract(overrides, '$.${column}') = ?`,
          [ref],
        ),
      ]),
      statement(this.db, 'DELETE FROM image_owner WHERE hash = ?', [hash]),
      statement(this.db, 'DELETE FROM image_source WHERE hash = ?', [hash]),
      statement(this.db, 'DELETE FROM image WHERE hash = ?', [hash]),
    ]);
  }

  /**
   * Reads every catalog and entry table to find unreferenced images; for maintenance jobs only. D1 caps
   * compound selects at a handful of terms, so the references are read with one statement each in a single
   * `batch` and matched in memory.
   */
  async orphans(createdBefore?: string): Promise<string[]> {
    const prefix = imageRef('');
    const referenceReads = IMAGE_COLUMNS.flatMap(({ table, column }) => [
      `SELECT ${column} AS ref FROM ${table} WHERE ${column} IS NOT NULL`,
      `SELECT json_extract(overrides, '$.${column}') AS ref FROM ${table}_entry
       WHERE json_extract(overrides, '$.${column}') IS NOT NULL`,
    ]);
    const reviewReads = REVIEW_TABLES.map(
      (table) => `SELECT review FROM ${table} WHERE instr(review, '${prefix}') > 0`,
    );
    const results = await this.db.batch(
      [
        'SELECT hash, source_url, created_at FROM image',
        'SELECT hash, url FROM image_source',
        'SELECT hash, created_at FROM image_owner',
        ...referenceReads,
        ...reviewReads,
      ].map((sql) => statement(this.db, sql)),
    );
    const [images = [], sources = [], owners = []] = results.slice(0, 3).map((r) => r.results);
    const referenceRows = results.slice(3, 3 + referenceReads.length);
    const reviews = results.slice(3 + referenceReads.length).flatMap((r) => r.results);
    const referenced = new Set(
      referenceRows.flatMap((r) => r.results.map((row) => String(row.ref))),
    );
    const reviewText = reviews.map((row) => String(row.review));
    return images
      .filter((row) => {
        const hash = String(row.hash);
        const ref = prefix + hash;
        if (referenced.has(ref)) return false;
        if (row.source_url !== null && referenced.has(String(row.source_url))) return false;
        if (sources.some((s) => String(s.hash) === hash && referenced.has(String(s.url)))) {
          return false;
        }
        if (reviewText.some((review) => review.includes(ref))) return false;
        if (createdBefore === undefined) return true;
        return (
          String(row.created_at) < createdBefore &&
          !owners.some((o) => String(o.hash) === hash && String(o.created_at) >= createdBefore)
        );
      })
      .map((row) => String(row.hash))
      .sort();
  }

  async addOwner(hash: string, userId: number, createdAt: string): Promise<void> {
    await execute(
      this.db,
      `INSERT INTO image_owner (hash, user_id, created_at) VALUES (?, ?, ?)
         ON CONFLICT (hash, user_id) DO NOTHING`,
      hash,
      userId,
      createdAt,
    );
  }

  async ownerIds(hash: string): Promise<number[]> {
    const rows = await queryAll(
      this.db,
      'SELECT user_id FROM image_owner WHERE hash = ? ORDER BY user_id',
      hash,
    );
    return rows.map((row) => Number(row.user_id));
  }

  async ownedBy(userId: number): Promise<StoredImage[]> {
    const rows = await queryAll(
      this.db,
      `SELECT image.* FROM image_owner JOIN image ON image.hash = image_owner.hash
         WHERE image_owner.user_id = ? ORDER BY image.created_at, image.hash`,
      userId,
    );
    return rows.map(imageFromRow);
  }

  async usedBytes(userId: number): Promise<number> {
    const row = await queryFirst(
      this.db,
      `SELECT COALESCE(SUM(image.byte_size), 0) AS used FROM image_owner
         JOIN image ON image.hash = image_owner.hash
         WHERE image_owner.user_id = ?`,
      userId,
    );
    return Number(row?.used ?? 0);
  }

  /** Scans the shared catalog tables for the reference, which no index covers. */
  async isShownByCatalog(hash: string): Promise<boolean> {
    const ref = imageRef(hash);
    const row = await queryFirst(
      this.db,
      `SELECT 1 AS shown WHERE ${IMAGE_COLUMNS.map(
        ({ table, column }) => `EXISTS (${catalogShowsSql(table, column)})`,
      ).join(' OR ')}`,
      ...IMAGE_COLUMNS.map(() => ref),
    );
    return row !== undefined;
  }
}
