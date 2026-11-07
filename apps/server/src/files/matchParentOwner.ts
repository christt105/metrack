import { chownSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * When running as root (the container), gives a new file or folder the owner of its folder, so
 * folders shared with the host stay owned by their user.
 */
export function matchParentOwner(path: string): void {
  if (process.getuid?.() !== 0) return;
  const parent = statSync(dirname(path));
  chownSync(path, parent.uid, parent.gid);
}
