import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { checkIntegrity } from '../storage/checkIntegrity.js';
import type { BackupInfo } from './BackupInfo.js';
import type { BackupPaths } from './BackupPaths.js';

const DB_FILE = 'metrack.db';
const IMAGES_DIR = 'images';
const NAME_PATTERN = /^metrack-\d{8}T\d{9}Z$/;

/**
 * Creates, verifies, lists, prunes and restores backups. Each backup is a directory holding a
 * consistent copy of the database (VACUUM INTO) and a copy of the image store when it exists.
 */
export class BackupService {
  constructor(
    private readonly db: DatabaseSync,
    private readonly paths: BackupPaths,
    private readonly backupDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Writes a new backup and verifies its integrity. A failed backup leaves nothing behind. */
  create(): BackupInfo {
    const name = formatName(this.now());
    const finalDir = join(this.backupDir, name);
    const partialDir = join(this.backupDir, `.partial-${name}`);
    if (existsSync(finalDir)) {
      throw new Error(`Backup ${name} already exists`);
    }
    rmSync(partialDir, { recursive: true, force: true });
    mkdirSync(partialDir, { recursive: true });
    try {
      const target = join(partialDir, DB_FILE);
      this.db.prepare('VACUUM INTO ?').run(target);
      checkIntegrity(target);
      if (existsSync(this.paths.imagesDir)) {
        cpSync(this.paths.imagesDir, join(partialDir, IMAGES_DIR), { recursive: true });
      }
      renameSync(partialDir, finalDir);
    } catch (error) {
      rmSync(partialDir, { recursive: true, force: true });
      throw error;
    }
    return describe(this.backupDir, name);
  }

  /** Lists backups, newest first. */
  list(): BackupInfo[] {
    if (!existsSync(this.backupDir)) {
      return [];
    }
    return readdirSync(this.backupDir)
      .filter((entry) => NAME_PATTERN.test(entry))
      .sort()
      .reverse()
      .map((name) => describe(this.backupDir, name));
  }

  /** Deletes all but the newest `keep` backups and returns the deleted names. */
  prune(keep: number): string[] {
    const removed = this.list()
      .slice(Math.max(keep, 1))
      .map((info) => info.name);
    for (const name of removed) {
      rmSync(join(this.backupDir, name), { recursive: true, force: true });
    }
    return removed;
  }

  /** Re-checks the integrity of a stored backup. */
  verify(name: string): void {
    checkIntegrity(join(this.requireBackup(name), DB_FILE));
  }

  /**
   * Replaces the live database and image store with a backup. The server must be stopped, since
   * the live database file is swapped out underneath any open connection.
   */
  restore(name: string): void {
    const source = this.requireBackup(name);
    checkIntegrity(join(source, DB_FILE));

    cpSync(join(source, DB_FILE), `${this.paths.dbPath}.restoring`);
    for (const suffix of ['-wal', '-shm']) {
      rmSync(`${this.paths.dbPath}${suffix}`, { force: true });
    }
    renameSync(`${this.paths.dbPath}.restoring`, this.paths.dbPath);

    rmSync(this.paths.imagesDir, { recursive: true, force: true });
    const imagesSource = join(source, IMAGES_DIR);
    if (existsSync(imagesSource)) {
      cpSync(imagesSource, this.paths.imagesDir, { recursive: true });
    }
  }

  private requireBackup(name: string): string {
    const dir = join(this.backupDir, name);
    if (!NAME_PATTERN.test(name) || !existsSync(join(dir, DB_FILE))) {
      throw new Error(`Unknown backup: ${name}`);
    }
    return dir;
  }
}

function formatName(date: Date): string {
  const iso = date.toISOString().replace(/[-:]/g, '').replace('.', '');
  return `metrack-${iso}`;
}

function describe(backupDir: string, name: string): BackupInfo {
  const dir = join(backupDir, name);
  const hasImages = existsSync(join(dir, IMAGES_DIR));
  return {
    name,
    createdAt: parseName(name),
    sizeBytes: directorySize(dir),
    hasImages,
  };
}

function parseName(name: string): string {
  const m = /^metrack-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/.exec(name);
  if (!m) {
    throw new Error(`Malformed backup name: ${name}`);
  }
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`;
}

function directorySize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? directorySize(path) : statSync(path).size;
  }
  return total;
}
