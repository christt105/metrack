import { parseDate } from './parseDate.js';
import type { IssueLog } from './IssueLog.js';
import type { VaultNote } from './VaultNote.js';

/** Reads a date field that describes the title (such as `release_date`), reporting odd values. */
export function readDescriptiveDate(
  note: VaultNote,
  field: string,
  issues: IssueLog,
): string | null {
  const date = parseDate(note.frontmatter[field]);
  if (date.odd) issues.add('odd-date', note.path, `${field}: ${String(note.frontmatter[field])}`);
  return date.value;
}
