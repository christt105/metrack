import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ensureOwnedDir } from '../files/ensureOwnedDir.js';
import { matchParentOwner } from '../files/matchParentOwner.js';
import { checkIntegrity } from '../storage/checkIntegrity.js';
import type { BackupCopyConfig } from './BackupCopyConfig.js';
import type { BackupCopyResult } from './BackupCopyResult.js';
import { listedImages } from './listedImages.js';
import type { BackupService } from './BackupService.js';

const DB_FILE = 'metrack.db';
const IMAGES_DIR = 'images';
const DATABASES_DIR = 'databases';
const DATABASE_PATTERN = /^(metrack-\d{8}T\d{9}Z)\.db$/;

/**
 * Keeps a copy of the backups in another folder, usually on another disk: one database file per
 * backup and a single shared image folder. Images are stored by hash and never change, so each
 * one is copied once however many backups hold it, and removed again once no copied database lists it,
 * so an image deleted from the store (for example with a deleted account) leaves the copy together with
 * the last database that held it. A database is only written after all of its images, so every copied
 * database has its images next to it.
 */
export class BackupCopier {
  constructor(
    private readonly service: BackupService,
    private readonly backupDir: string,
    private readonly config: BackupCopyConfig,
  ) {}

  /** Copies every local backup missing from the copy, oldest first, then applies retention. */
  sync(): BackupCopyResult {
    const result: BackupCopyResult = { copied: [], images: 0, pruned: [], prunedImages: 0 };
    const known = new Set(this.list());
    ensureOwnedDir(join(this.config.dir, DATABASES_DIR));
    for (const { name } of this.service.list().reverse()) {
      if (known.has(name)) continue;
      result.images += this.copyImages(join(this.backupDir, name, IMAGES_DIR));
      this.copyDatabase(name);
      result.copied.push(name);
    }
    result.pruned = this.prune();
    result.prunedImages = this.pruneImages();
    return result;
  }

  /** Lists the copied backups, newest first. */
  list(): string[] {
    const dir = join(this.config.dir, DATABASES_DIR);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .map((entry) => DATABASE_PATTERN.exec(entry)?.[1])
      .filter((name): name is string => name !== undefined)
      .sort()
      .reverse();
  }

  /**
   * Rebuilds a copied backup as a regular backup directory under the backup folder, so `restore`
   * can use it. It gets every image in the copy, which may include images that backup no longer
   * references; removing unused images afterwards drops them.
   */
  retrieve(name: string): string {
    const source = join(this.config.dir, DATABASES_DIR, `${name}.db`);
    if (!DATABASE_PATTERN.test(`${name}.db`) || !existsSync(source)) {
      throw new Error(`Unknown copied backup: ${name}`);
    }
    checkIntegrity(source);
    const finalDir = join(this.backupDir, name);
    if (existsSync(finalDir)) throw new Error(`Backup ${name} already exists locally`);
    const partialDir = join(this.backupDir, `.partial-${name}`);
    rmSync(partialDir, { recursive: true, force: true });
    mkdirSync(partialDir, { recursive: true });
    try {
      copyFileSync(source, join(partialDir, DB_FILE));
      const images = join(this.config.dir, IMAGES_DIR);
      if (existsSync(images)) {
        mkdirSync(join(partialDir, IMAGES_DIR));
        for (const file of readdirSync(images)) {
          if (file.startsWith('.')) continue;
          copyFileSync(join(images, file), join(partialDir, IMAGES_DIR, file));
        }
      }
      renameSync(partialDir, finalDir);
    } catch (error) {
      rmSync(partialDir, { recursive: true, force: true });
      throw error;
    }
    return finalDir;
  }

  private copyImages(source: string): number {
    if (!existsSync(source)) return 0;
    const target = join(this.config.dir, IMAGES_DIR);
    ensureOwnedDir(target);
    let copied = 0;
    for (const file of readdirSync(source)) {
      if (file.startsWith('.') || existsSync(join(target, file))) continue;
      copyAtomic(join(source, file), join(target, file));
      copied += 1;
    }
    return copied;
  }

  private copyDatabase(name: string): void {
    const dir = join(this.config.dir, DATABASES_DIR);
    const temporary = join(dir, `.${name}.db.partial`);
    try {
      copyFileSync(join(this.backupDir, name, DB_FILE), temporary);
      checkIntegrity(temporary);
      matchParentOwner(temporary);
      renameSync(temporary, join(dir, `${name}.db`));
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  }

  /**
   * Removes the images no retained copied database lists. If any of those databases cannot be read the
   * images are all kept.
   */
  private pruneImages(): number {
    const dir = join(this.config.dir, IMAGES_DIR);
    if (!existsSync(dir)) return 0;
    const keep = new Set<string>();
    for (const name of this.list()) {
      const files = listedImages(join(this.config.dir, DATABASES_DIR, `${name}.db`));
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

  private prune(): string[] {
    const removed = this.list().slice(Math.max(this.config.retention, 1));
    for (const name of removed) {
      rmSync(join(this.config.dir, DATABASES_DIR, `${name}.db`), { force: true });
    }
    return removed;
  }
}

function copyAtomic(source: string, target: string): void {
  const temporary = `${target}.partial`;
  try {
    copyFileSync(source, temporary);
    matchParentOwner(temporary);
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}
