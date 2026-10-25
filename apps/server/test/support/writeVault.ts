import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Creates a temporary Media Tracker folder from a map of relative paths to contents. */
export function writeVault(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-vault-'));
  for (const [path, content] of Object.entries(files)) {
    const target = join(dir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return dir;
}
