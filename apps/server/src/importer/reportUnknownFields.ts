import { knownFields } from './knownFields.js';
import type { IssueLog } from './IssueLog.js';
import type { VaultNote } from './VaultNote.js';

export function reportUnknownFields(note: VaultNote, issues: IssueLog): void {
  const known = knownFields(note.kind);
  const unknown = Object.keys(note.frontmatter).filter((key) => !known.has(key));
  if (unknown.length > 0) issues.add('unknown-field', note.path, unknown.join(', '));
}
