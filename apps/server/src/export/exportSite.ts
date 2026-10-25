import { buildExport, fingerprintExport } from '@metrack/export';
import type { ImageStore } from '../images/ImageStore.js';
import { loadExportInput, type ExportSources } from './loadExportInput.js';
import { writeExport } from './writeExport.js';

export interface ExportResult {
  files: number;
  fingerprint: string;
}

/** Exports the stored data to `outDir` and returns what was written. */
export function exportSite(sources: ExportSources, outDir: string): ExportResult {
  const files = buildExport(loadExportInput(sources));
  const store: ImageStore = sources.images;
  writeExport(files, outDir, (hash) => {
    const image = store.get(hash);
    if (!image) throw new Error(`Image ${hash} is referenced but not in the store`);
    return store.pathOf(image);
  });
  return { files: files.length, fingerprint: fingerprintExport(files) };
}
