import type { VaultMirrorResult } from './VaultMirrorResult.js';

function list(title: string, paths: string[], verbose: boolean): string[] {
  if (paths.length === 0) return [];
  const shown = verbose ? paths : paths.slice(0, 10);
  const more = paths.length - shown.length;
  return [
    `${title}: ${paths.length}`,
    ...shown.map((path) => `  ${path}`),
    ...(more > 0 ? [`  ... and ${more} more (--verbose lists them all)`] : []),
  ];
}

/** The text the CLI prints after a mirror run. */
export function formatMirrorResult(
  result: VaultMirrorResult,
  applied: boolean,
  verbose: boolean,
): string {
  return [
    applied ? 'Vault mirror updated.' : 'Vault mirror report, nothing was written.',
    `Unchanged notes: ${result.unchanged}`,
    ...list('New notes', result.created, verbose),
    ...list('Changed notes', result.updated, verbose),
    ...list('Removed notes', result.removed, verbose),
    ...list('Images copied into the vault', result.copiedImages, verbose),
    ...list(
      'Skipped, front matter unreadable',
      result.skipped.map((entry) => `${entry.path}: ${entry.reason}`),
      true,
    ),
    ...list('Notes not written by the mirror, left alone', result.unmanaged, true),
  ].join('\n');
}
