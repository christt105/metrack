import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Looks for a file a note refers to, in the places the old migration script searched. */
export function findVaultFile(vaultDir: string, target: string): string | null {
  const name = basename(target);
  const candidates = [
    join(dirname(vaultDir), target),
    join(vaultDir, target),
    join(vaultDir, 'Portadas', name),
    join(vaultDir, 'Files', name),
  ];
  return candidates.find(isFile) ?? null;
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}
