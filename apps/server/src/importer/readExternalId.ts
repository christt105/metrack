import { readInteger } from './fieldReaders.js';
import type { IssueLog } from './IssueLog.js';
import type { VaultNote } from './VaultNote.js';

/** Reads an integer id field and reports values that are not integers. */
export function readExternalId(note: VaultNote, field: string, issues: IssueLog): number | null {
  const id = readInteger(note.frontmatter[field]);
  if (id.invalid)
    issues.add('invalid-id', note.path, `${field}: ${String(note.frontmatter[field])}`);
  return id.value;
}
