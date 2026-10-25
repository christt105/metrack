import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ExportedFile } from '@metrack/export';

/** The content sections an export owns. Anything else in the output directory is left alone. */
export const EXPORT_SECTIONS = ['movies', 'tv', 'seasons', 'games', 'books'];

/**
 * Writes an export under `outDir`, replacing the sections it owns so removed items do not linger.
 * `imagePath` maps an image hash to the file in the image store.
 */
export function writeExport(
  files: ExportedFile[],
  outDir: string,
  imagePath: (hash: string) => string,
): void {
  for (const section of EXPORT_SECTIONS) {
    rmSync(join(outDir, 'content', section), { recursive: true, force: true });
  }
  for (const file of files) {
    const target = join(outDir, file.path);
    mkdirSync(dirname(target), { recursive: true });
    if (file.kind === 'text') writeFileSync(target, file.content);
    else copyFileSync(imagePath(file.hash), target);
  }
}
