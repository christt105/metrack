import { isSafeSlug } from '@metrack/domain';
import type { VaultNote } from './VaultNote.js';

/** The note name as the page slug, or null when it cannot be a folder name and the exporter must derive one. */
export function readSlug(note: VaultNote): string | null {
  return isSafeSlug(note.name) ? note.name : null;
}
