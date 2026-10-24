import { basename } from 'node:path';
import { findVaultFile } from './findVaultFile.js';
import type { InlineImage } from './InlineImage.js';
import type { IssueLog } from './IssueLog.js';
import type { VaultNote } from './VaultNote.js';

const EMBED = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** Finds the `![[file]]` embeds of a note body. Embeds without a file in the vault are reported and left out. */
export function readInlineImages(
  note: VaultNote,
  vaultDir: string,
  issues: IssueLog,
): InlineImage[] {
  const found = new Map<string, InlineImage>();
  for (const match of note.body.matchAll(EMBED)) {
    const embed = match[0];
    const target = match[1]?.trim() ?? '';
    if (found.has(embed)) continue;
    const path = findVaultFile(vaultDir, target);
    if (path === null) issues.add('missing-image', note.path, `embed: ${embed}`);
    else found.set(embed, { embed, path, alt: basename(target) });
  }
  return [...found.values()];
}
