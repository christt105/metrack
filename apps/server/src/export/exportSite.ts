import { buildExport, fingerprintExport } from '@metrack/export';
import { loadExportInput, type ExportSources } from './loadExportInput.js';
import { storeImageReader } from './storeImageReader.js';
import { writeExport } from './writeExport.js';

export interface ExportResult {
  files: number;
  fingerprint: string;
}

/** Exports the stored data to `outDir` and returns what was written. */
export async function exportSite(sources: ExportSources, outDir: string): Promise<ExportResult> {
  const files = buildExport(await loadExportInput(sources));
  await writeExport(files, outDir, storeImageReader(sources.images));
  return { files: files.length, fingerprint: fingerprintExport(files) };
}
