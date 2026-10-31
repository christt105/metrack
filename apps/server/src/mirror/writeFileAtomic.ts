import { chownSync, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

function matchParentOwner(path: string): void {
  if (process.getuid?.() !== 0) return;
  const parent = statSync(dirname(path));
  chownSync(path, parent.uid, parent.gid);
}

function ensureDir(dir: string): void {
  if (existsSync(dir)) return;
  ensureDir(dirname(dir));
  mkdirSync(dir);
  matchParentOwner(dir);
}

/**
 * Writes through a temporary file in the same folder so sync tools never see a half-written file.
 * When running as root (the container) the file takes the owner of its folder, so the vault stays
 * owned by its user.
 */
export function writeFileAtomic(path: string, data: string | Uint8Array): void {
  ensureDir(dirname(path));
  const temporary = join(dirname(path), `.${basename(path)}.metrack-tmp`);
  writeFileSync(temporary, data);
  matchParentOwner(temporary);
  renameSync(temporary, path);
}
