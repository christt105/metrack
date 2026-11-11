import type { AccountExportData } from '../api/AccountExportData';
import type { ApiClient } from '../api/ApiClient';
import type { AccountExportResult } from './AccountExportResult';
import type { ExportProgress } from './ExportProgress';
import { ZipWriter } from './ZipWriter';

const CONCURRENCY = 4;

type ExportSource = Pick<ApiClient, 'accountExportData' | 'imageBytes'>;

/**
 * Packs the signed-in user's data into the same ZIP the server would build: `data.json` and the image files
 * under `images/`. An image whose file cannot be fetched is left out and its entry gets `file: null`; its hash
 * is listed in `missing`.
 */
export async function buildAccountExport(
  api: ExportSource,
  onProgress: (progress: ExportProgress) => void = () => {},
): Promise<AccountExportResult> {
  const data: AccountExportData = await api.accountExportData();
  const pending = data.images.filter((image) => image.file !== null);
  const files = new Map<string, Uint8Array>();
  const missing: string[] = [];
  let done = 0;
  let next = 0;
  onProgress({ done, total: pending.length });

  const worker = async (): Promise<void> => {
    while (next < pending.length) {
      const image = pending[next++]!;
      try {
        files.set(image.hash, await api.imageBytes(image.hash));
      } catch {
        missing.push(image.hash);
        image.file = null;
      }
      onProgress({ done: ++done, total: pending.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

  const exportedAt = new Date(data.exportedAt);
  const zip = new ZipWriter(exportedAt);
  for (const image of pending) {
    const bytes = files.get(image.hash);
    if (bytes && image.file) await zip.add(image.file, bytes);
  }
  const json = new TextEncoder().encode(JSON.stringify(data, null, 2));
  await zip.add('data.json', json, true);
  return {
    blob: zip.toBlob(),
    fileName: `metrack-export-user-${data.user.id}-${data.exportedAt.slice(0, 10)}.zip`,
    missing,
  };
}
