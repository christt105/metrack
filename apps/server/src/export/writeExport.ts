import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { ExportedFile } from '@metrack/export';

/** The content sections an export owns. Anything else in the output directory is left alone. */
export const EXPORT_SECTIONS = ['movies', 'tv', 'seasons', 'games', 'books'];

function targetInside(outDir: string, path: string): string {
  const target = resolve(outDir, path);
  const fromRoot = relative(resolve(outDir), target);
  if (
    fromRoot === '' ||
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new Error(`Refusing to write outside the export directory: ${path}`);
  }
  return target;
}

/**
 * Writes an export under `outDir`, replacing the sections it owns so removed items do not linger.
 * `imagePath` maps an image hash to the file in the image store. Throws before touching the disk
 * when any file would land outside `outDir`.
 */
export function writeExport(
  files: ExportedFile[],
  outDir: string,
  imagePath: (hash: string) => string,
): void {
  const writes = files.map((file) => ({ file, target: targetInside(outDir, file.path) }));
  for (const section of EXPORT_SECTIONS) {
    rmSync(join(outDir, 'content', section), { recursive: true, force: true });
  }
  for (const { file, target } of writes) {
    mkdirSync(dirname(target), { recursive: true });
    if (file.kind === 'text') writeFileSync(target, file.content);
    else copyFileSync(imagePath(file.hash), target);
  }
}
