import { existsSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureOwnedDir } from '../files/ensureOwnedDir.js';
import { matchParentOwner } from '../files/matchParentOwner.js';
import { listedImages } from '../backup/listedImages.js';
import { checkIntegrity } from '../storage/checkIntegrity.js';
import type { CloudBackupResult } from './CloudBackupResult.js';
import { countRows } from './countRows.js';
import type { D1Exporter } from './D1Exporter.js';
import { formatBackupStamp } from './formatBackupStamp.js';
import { importD1Dump } from './importD1Dump.js';
import { parseBackupStamp } from './parseBackupStamp.js';
import type { R2Client } from './R2Client.js';

const IMAGES_DIR = 'images';
const DATABASES_DIR = 'databases';
const DATABASE_PATTERN = /^(metrack-(\d{8}T\d{9}Z))\.db$/;
const IMAGE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Keeps a local copy of the cloud data in the layout of `BackupCopier`: one `metrack-<stamp>.db` per run in
 * `databases/` and one shared `images/` folder. The database comes from the D1 export, loaded into a new SQLite file
 * and integrity checked; the images come from R2, and only the ones the new database lists and the copy does not have are downloaded, since
 * they are stored by hash and never change. Images are written before the database and removed only once no retained
 * database lists them, so every copied database has its images next to it. Every file is written under a partial
 * name and renamed.
 */
export class CloudBackup {
  constructor(
    private readonly dir: string,
    private readonly retention: number,
    private readonly d1: D1Exporter,
    private readonly r2: R2Client | undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Lists the copied databases, newest first. */
  list(): string[] {
    const dir = join(this.dir, DATABASES_DIR);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .map((entry) => DATABASE_PATTERN.exec(entry)?.[1])
      .filter((name): name is string => name !== undefined)
      .sort()
      .reverse();
  }

  /** When the newest copy was made, or undefined when there is none. */
  newest(): Date | undefined {
    const name = this.list()[0];
    return name ? parseBackupStamp(name.slice('metrack-'.length)) : undefined;
  }

  async run(): Promise<CloudBackupResult> {
    const started = Date.now();
    const databases = join(this.dir, DATABASES_DIR);
    ensureOwnedDir(databases);
    const name = `metrack-${formatBackupStamp(this.now())}`;
    const temporary = join(databases, `.${name}.db.partial`);
    try {
      const sql = await this.d1.export();
      rmSync(temporary, { force: true });
      importD1Dump(sql, temporary);
      checkIntegrity(temporary);
      const rows = Object.values(countRows(temporary)).reduce((sum, count) => sum + count, 0);
      const images = await this.copyImages(listedImages(temporary));
      matchParentOwner(temporary);
      renameSync(temporary, join(databases, `${name}.db`));
      const final = join(databases, `${name}.db`);
      const pruned = this.prune();
      return {
        name,
        sqlBytes: Buffer.byteLength(sql),
        databaseBytes: statSync(final).size,
        rows,
        bucketObjects: images.objects,
        images: images.downloaded,
        imageBytes: images.bytes,
        missingImages: this.missingImages(final),
        pruned,
        prunedImages: this.pruneImages(),
        durationMs: Date.now() - started,
      };
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  }

  private async copyImages(
    listed: string[] | undefined,
  ): Promise<{ objects: number; downloaded: number; bytes: number }> {
    if (!this.r2) return { objects: 0, downloaded: 0, bytes: 0 };
    const target = join(this.dir, IMAGES_DIR);
    ensureOwnedDir(target);
    const objects = await this.r2.list();
    const wanted = listed === undefined ? undefined : new Set(listed);
    let downloaded = 0;
    let bytes = 0;
    for (const { key, size } of objects) {
      if (!IMAGE_KEY.test(key) || (wanted && !wanted.has(key))) continue;
      if (existsSync(join(target, key))) continue;
      const body = await this.r2.get(key);
      if (body.length !== size) {
        throw new Error(`R2 object ${key} came back with ${body.length} bytes, expected ${size}`);
      }
      writeAtomic(join(target, key), body);
      downloaded += 1;
      bytes += body.length;
    }
    return { objects: objects.length, downloaded, bytes };
  }

  private missingImages(databasePath: string): number {
    if (!this.r2) return 0;
    const images = join(this.dir, IMAGES_DIR);
    return (listedImages(databasePath) ?? []).filter((file) => !existsSync(join(images, file)))
      .length;
  }

  private prune(): string[] {
    const removed = this.list().slice(Math.max(this.retention, 1));
    for (const name of removed) {
      rmSync(join(this.dir, DATABASES_DIR, `${name}.db`), { force: true });
    }
    return removed;
  }

  private pruneImages(): number {
    const dir = join(this.dir, IMAGES_DIR);
    if (!this.r2 || !existsSync(dir)) return 0;
    const keep = new Set<string>();
    for (const name of this.list()) {
      const files = listedImages(join(this.dir, DATABASES_DIR, `${name}.db`));
      if (files === undefined) return 0;
      for (const file of files) keep.add(file);
    }
    let removed = 0;
    for (const file of readdirSync(dir)) {
      if (file.startsWith('.') || keep.has(file)) continue;
      rmSync(join(dir, file), { force: true });
      removed += 1;
    }
    return removed;
  }
}

function writeAtomic(target: string, body: Buffer): void {
  const temporary = `${target}.partial`;
  try {
    writeFileSync(temporary, body);
    matchParentOwner(temporary);
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}
