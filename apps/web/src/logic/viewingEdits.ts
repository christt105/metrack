import { normalizeViewings, type Viewing } from '@metrack/domain';
import type { Messages } from '../i18n/messages/Messages';

/** The viewings as the list shows them: newest first, the open one on top. */
export function newestFirst(viewings: readonly Viewing[]): Viewing[] {
  return [...normalizeViewings(viewings)].reverse();
}

/** A viewing as a short line: one date when start and finish match or only one is known, a range otherwise. */
export function describeViewing(viewing: Viewing, messages: Messages): string {
  const date = (value: string) => messages.episodes.airDate(value);
  const { startedAt, finishedAt } = viewing;
  if (startedAt === null && finishedAt === null) return messages.history.unknownDate;
  if (finishedAt === null) {
    return startedAt === null
      ? messages.history.watchingNoStart
      : messages.history.watchingSince(date(startedAt));
  }
  if (startedAt === null || startedAt === finishedAt) return date(finishedAt);
  return messages.history.range(date(startedAt), date(finishedAt));
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
  const abandonedAt = list[index]?.abandonedAt;
  list[index] = abandonedAt === undefined ? replacement : { ...replacement, abandonedAt };
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
