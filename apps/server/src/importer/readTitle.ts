import { readText } from './fieldReaders.js';
import type { IssueLog } from './IssueLog.js';
import type { VaultNote } from './VaultNote.js';

export function readTitle(note: VaultNote, issues: IssueLog): string {
  const title = readText(note.frontmatter.title);
  if (title !== null) return title;
  issues.add('missing-title', note.path);
  return note.name;
}
