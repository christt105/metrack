import type { DatabaseSync } from 'node:sqlite';
import { IMAGE_COLUMNS } from '../../images/imageColumns.js';
import { imageRef } from '../../images/imageRef.js';
import type { StoredImage } from '../../images/StoredImage.js';
import type { ImageRepository } from '../repositories/ImageRepository.js';
import type { Row } from './Row.js';

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
    }
    this.db.prepare('DELETE FROM image_source WHERE hash = ?').run(hash);
    this.db.prepare('DELETE FROM image WHERE hash = ?').run(hash);
  }

  async orphans(): Promise<string[]> {
    const referenced = IMAGE_COLUMNS.map(
      ({ table, column }) => `SELECT ${column} AS ref FROM ${table} WHERE ${column} IS NOT NULL`,
    ).join(' UNION ');
    return this.db
      .prepare(
        `SELECT hash FROM image WHERE '${imageRef('')}' || hash NOT IN (${referenced}) ORDER BY hash`,
      )
      .all()
      .map((row) => String(row.hash));
  }
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
