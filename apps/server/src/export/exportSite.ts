import { buildExport, fingerprintExport } from '@metrack/export';
import { loadExportInput, type ExportSources } from './loadExportInput.js';
import { storeImagePath } from './storeImagePath.js';
import { writeExport } from './writeExport.js';

export interface ExportResult {
  files: number;
  fingerprint: string;
}

/** Exports the stored data to `outDir` and returns what was written. */
export function exportSite(sources: ExportSources, outDir: string): ExportResult {
  const files = buildExport(loadExportInput(sources));
  writeExport(files, outDir, storeImagePath(sources.images));
  return { files: files.length, fingerprint: fingerprintExport(files) };
}
