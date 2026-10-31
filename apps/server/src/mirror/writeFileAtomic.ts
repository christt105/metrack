import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Writes through a temporary file in the same folder so sync tools never see a half-written file. */
export function writeFileAtomic(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.metrack-tmp`);
  writeFileSync(temporary, data);
  renameSync(temporary, path);
}
