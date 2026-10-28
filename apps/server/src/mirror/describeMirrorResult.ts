import type { VaultMirrorResult } from './VaultMirrorResult.js';

/** One line for the log after an automatic run. */
export function describeMirrorResult(result: VaultMirrorResult): string {
  const parts = [
    `${result.created.length} created`,
    `${result.updated.length} changed`,
    `${result.removed.length} removed`,
    `${result.copiedImages.length} images copied`,
  ];
  if (result.skipped.length > 0) {
    parts.push(
      `${result.skipped.length} skipped (${result.skipped.map((s) => s.path).join(', ')})`,
    );
  }
  return parts.join(', ');
}
