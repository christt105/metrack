import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { matchParentOwner } from './matchParentOwner.js';

/** Creates a folder and any missing parents, each owned like its own parent (see matchParentOwner). */
export function ensureOwnedDir(dir: string): void {
  if (existsSync(dir)) return;
  ensureOwnedDir(dirname(dir));
  mkdirSync(dir);
  matchParentOwner(dir);
}
