import { renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { ensureOwnedDir } from '../files/ensureOwnedDir.js';
import { matchParentOwner } from '../files/matchParentOwner.js';

/**
 * Writes through a temporary file in the same folder so sync tools never see a half-written file.
 * When running as root (the container) the file takes the owner of its folder, so the vault stays
 * owned by its user.
 */
export function writeFileAtomic(path: string, data: string | Uint8Array): void {
  ensureOwnedDir(dirname(path));
  const temporary = join(dirname(path), `.${basename(path)}.metrack-tmp`);
  writeFileSync(temporary, data);
  matchParentOwner(temporary);
  renameSync(temporary, path);
}
