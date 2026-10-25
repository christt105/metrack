import { createHash } from 'node:crypto';
import type { ExportedFile } from './ExportedFile.js';

/** A hash of an export's paths and contents, equal exactly when the exported site would be. */
export function fingerprintExport(files: ExportedFile[]): string {
  const hash = createHash('sha256');
  for (const file of files) {
    const content = file.kind === 'text' ? file.content : `image:${file.hash}`;
    hash.update(`${file.kind}\0${file.path}\0${content.length}\0${content}\0`);
  }
  return hash.digest('hex');
}
