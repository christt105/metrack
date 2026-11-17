import { normalizeViewings, type Viewing } from '@metrack/domain';

/** The viewings as the list shows them: newest first, the open one on top. */
export function newestFirst(viewings: readonly Viewing[]): Viewing[] {
  return [...normalizeViewings(viewings)].reverse();
}

/** A viewing as a short line, with a placeholder for a missing start. */
export function describeViewing(viewing: Viewing): string {
  if (viewing.finishedAt === null) {
    return viewing.startedAt ? `Watching since ${viewing.startedAt}` : 'Watching, no start date';
  }
  return `${viewing.startedAt ?? '?'} - ${viewing.finishedAt}`;
}

/** Turns what a form holds into a viewing: empty text becomes a missing date. */
export function viewingFromForm(start: string, end: string): Viewing {
  return { startedAt: start === '' ? null : start, finishedAt: end === '' ? null : end };
}

/** The full list after adding a viewing. */
export function withViewing(viewings: readonly Viewing[], added: Viewing): Viewing[] {
  return normalizeViewings([...viewings, added]);
}

/** The full list after replacing the viewing at `index` of the newest-first list. */
export function withReplaced(
  viewings: readonly Viewing[],
  index: number,
  replacement: Viewing,
): Viewing[] {
  const list = newestFirst(viewings);
  list[index] = replacement;
  return normalizeViewings(list);
}

/** The full list after removing the viewing at `index` of the newest-first list. */
export function withoutViewing(viewings: readonly Viewing[], index: number): Viewing[] {
  return normalizeViewings(newestFirst(viewings).filter((_, at) => at !== index));
}

/** Whether a form can be saved: a closed viewing needs an end that does not precede its start. */
export function formIsValid(start: string, end: string, needsEnd: boolean): boolean {
  if (end === '') return !needsEnd;
  return start === '' || start <= end;
}
