import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { FetchFn } from '../http/FetchFn.js';
import { IMAGE_COLUMNS } from './imageColumns.js';
import { imageRef } from './imageRef.js';
import { readBodyWithLimit } from './readBodyWithLimit.js';
import { readImageSize } from './readImageSize.js';
import type { StoredImage } from './StoredImage.js';

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

type Row = Record<string, unknown>;

/**
 * Local image store. Files are named by the SHA-256 of their content, so identical
 * images are stored once. Entities point at the copy through `imageRef`. An image keeps the
 * first URL it came from as `sourceUrl`; any other URL that yields the same bytes is recorded
 * as an extra source so `findBySourceUrl` resolves it too.
 */
export class ImageStore {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dir: string,
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {
    mkdirSync(dir, { recursive: true });
  }

  /** Downloads an image unless this exact URL was already stored. */
  async download(url: string): Promise<StoredImage> {
    const known = this.findBySourceUrl(url);
    if (known && existsSync(this.pathOf(known))) return known;

    const response = await this.fetchFn(url);
    if (!response.ok) throw new Error(`Image download failed (${response.status}) for ${url}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_IMAGE_BYTES) {
      await response.body?.cancel();
      throw new Error(`Image too large: ${url}`);
    }
    const bytes = await readBodyWithLimit(response, MAX_IMAGE_BYTES);
    if (bytes === null) throw new Error(`Image too large: ${url}`);
    return this.add(bytes, url);
  }

  /** Copies an existing local file into the store, optionally recording the URL it stands for. */
  async importFile(path: string, sourceUrl: string | null = null): Promise<StoredImage> {
    if ((await stat(path)).size > MAX_IMAGE_BYTES) throw new Error('Image too large');
    return this.add(new Uint8Array(await readFile(path)), sourceUrl);
  }

  /** Stores raw image bytes. Throws when they are not a supported image or exceed the size limit. */
  async add(bytes: Uint8Array, sourceUrl: string | null): Promise<StoredImage> {
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image too large');
    const size = readImageSize(bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const existing = this.get(hash);
    if (existing && existsSync(this.pathOf(existing))) return this.withSource(existing, sourceUrl);

    const image: StoredImage = {
      hash,
      ref: imageRef(hash),
      extension: size.extension,
      mimeType: size.mimeType,
      width: size.width,
      height: size.height,
      byteSize: bytes.byteLength,
      sourceUrl,
      createdAt: this.now().toISOString(),
    };
    const target = this.pathOf(image);
    const temp = `${target}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await writeFile(temp, bytes);
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
    const stored = this.get(hash);
    if (stored) return this.withSource(stored, sourceUrl);
    this.db
      .prepare(
        `INSERT INTO image (hash, extension, mime_type, width, height, byte_size, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        hash,
        image.extension,
        image.mimeType,
        image.width,
        image.height,
        image.byteSize,
        sourceUrl,
        image.createdAt,
      );
    return image;
  }

  get(hash: string): StoredImage | undefined {
    const row = this.db.prepare('SELECT * FROM image WHERE hash = ?').get(hash);
    return row ? toImage(row) : undefined;
  }

  list(): StoredImage[] {
    return this.db
      .prepare('SELECT * FROM image ORDER BY created_at, hash')
      .all()
      .map((row) => toImage(row));
  }

  pathOf(image: StoredImage): string {
    return join(this.dir, `${image.hash}.${image.extension}`);
  }

  read(image: StoredImage): Buffer {
    return readFileSync(this.pathOf(image));
  }

  /** Deletes the file and its row and clears every cover or banner that referenced it. */
  async delete(hash: string): Promise<boolean> {
    const image = this.get(hash);
    if (!image) return false;
    for (const { table, column } of IMAGE_COLUMNS) {
      this.db.prepare(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`).run(image.ref);
    }
    this.db.prepare('DELETE FROM image_source WHERE hash = ?').run(hash);
    this.db.prepare('DELETE FROM image WHERE hash = ?').run(hash);
    await rm(this.pathOf(image), { force: true });
    return true;
  }

  /** Hashes of stored images that no entity references. */
  orphans(): string[] {
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

  /** Deletes every orphan and returns their hashes. */
  async cleanOrphans(): Promise<string[]> {
    const orphans = this.orphans();
    for (const hash of orphans) await this.delete(hash);
    return orphans;
  }

  /** The stored copy of a URL, without ever hitting the network. */
  findBySourceUrl(url: string): StoredImage | undefined {
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

  private withSource(image: StoredImage, sourceUrl: string | null): StoredImage {
    if (sourceUrl !== null && sourceUrl !== image.sourceUrl) {
      this.db
        .prepare(
          `INSERT INTO image_source (url, hash) VALUES (?, ?)
           ON CONFLICT (url) DO UPDATE SET hash = excluded.hash`,
        )
        .run(sourceUrl, image.hash);
    }
    return image;
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
