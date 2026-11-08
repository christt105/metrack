import { statusKey } from '@metrack/export';
import type { FinishedViewing } from './FinishedViewing.js';
import type { PublicEntry } from './PublicEntry.js';

const byTitle = (a: PublicEntry, b: PublicEntry): number => a.title.localeCompare(b.title, 'es');

/**
 * The finished items as dated viewings, newest first, each rewatch counting as its own. Items with
 * no remembered date come last, oldest release first.
 */
export function finishedViewings(entries: readonly PublicEntry[]): FinishedViewing[] {
  const viewings: FinishedViewing[] = [];
  for (const entry of entries) {
    if (statusKey(entry.status) !== 'finished') continue;
    viewings.push({ entry, date: entry.finishedAt });
    for (const date of entry.rewatches) viewings.push({ entry, date });
  }
  const dated = viewings
    .filter((viewing) => viewing.date !== null)
    .sort(
      (a, b) => (b.date as string).localeCompare(a.date as string) || byTitle(a.entry, b.entry),
    );
  const undated = viewings
    .filter((viewing) => viewing.date === null)
    .sort(
      (a, b) =>
        (a.entry.releaseDate ?? '9999').localeCompare(b.entry.releaseDate ?? '9999') ||
        byTitle(a.entry, b.entry),
    );
  return [...dated, ...undated];
}
