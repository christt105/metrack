import type { Tracking } from '@metrack/domain';
import { parseDate } from './parseDate.js';
import { parseRating } from './parseRating.js';
import { parseStatus } from './parseStatus.js';
import { readList } from './fieldReaders.js';
import type { IssueLog } from './IssueLog.js';
import type { VaultNote } from './VaultNote.js';

/** Builds the tracking data of a note. `date` becomes `finishedAt`. */
export function readTracking(note: VaultNote, issues: IssueLog): Tracking {
  const status = parseStatus(note.frontmatter.status);
  if (status.problem === 'missing') issues.add('missing-status', note.path);
  if (status.problem === 'unknown') {
    issues.add('unknown-status', note.path, String(note.frontmatter.status));
  }

  const finished = parseDate(note.frontmatter.date);
  if (finished.odd) issues.add('odd-date', note.path, `date: ${String(note.frontmatter.date)}`);
  if (status.value === 'completed' && finished.value === null && !finished.odd) {
    issues.add('completed-without-date', note.path);
  }

  const rating = parseRating(note.frontmatter.rating);
  if (rating.odd) issues.add('odd-rating', note.path, String(note.frontmatter.rating));

  const rewatches: string[] = [];
  for (const entry of readList(note.frontmatter.rewatches)) {
    const date = parseDate(entry);
    if (date.value === null) issues.add('odd-date', note.path, `rewatches: ${entry}`);
    else rewatches.push(date.value);
  }

  const review = note.body.trim();
  return {
    status: status.value,
    startedAt: null,
    finishedAt: finished.value,
    rating: rating.value,
    review: review === '' ? null : review,
    rewatches,
    pendingReview: false,
  };
}
