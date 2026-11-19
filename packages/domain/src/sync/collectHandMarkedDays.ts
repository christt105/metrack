import { COMPANION_WINDOW_DAYS } from './COMPANION_WINDOW_DAYS.js';
import type { HandMarkedCounts } from './HandMarkedCounts.js';
import type { HandMarkedPlays } from './HandMarkedPlays.js';
import { WATCHED_FRACTION } from './WATCHED_FRACTION.js';

const DAY_MS = 86_400_000;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/**
 * Dates the items marked as played with no playback of the account. An item gets the latest day on which a companion
 * played it completely (`WATCHED_FRACTION` of its runtime in that day; any playback when the runtime is unknown) within the
 * `COMPANION_WINDOW_DAYS` days up to the day of the mark. Otherwise it gets an empty list: watched, on no known day.
 */
export function collectHandMarkedDays(
  items: ReadonlyMap<string, number | null>,
  handMarked: HandMarkedPlays,
  dateOf: (iso: string) => string,
): { days: Map<string, string[]>; counts: HandMarkedCounts } {
  const perItem = new Map<string, Map<string, number>>();
  for (const play of handMarked.companionPlays) {
    if (!items.has(play.itemId)) continue;
    const perDay = perItem.get(play.itemId) ?? new Map<string, number>();
    const day = dateOf(play.playedAt);
    perDay.set(day, (perDay.get(day) ?? 0) + play.watchedSeconds);
    perItem.set(play.itemId, perDay);
  }
  const days = new Map<string, string[]>();
  const counts: HandMarkedCounts = { dated: 0, undated: 0 };
  for (const [itemId, runtime] of items) {
    const markedAt = handMarked.markedAt.get(itemId);
    const markDay = markedAt === undefined ? undefined : dateOf(markedAt);
    const found =
      markDay === undefined
        ? undefined
        : [...(perItem.get(itemId) ?? [])]
            .filter(([, total]) => runtime === null || total >= runtime * WATCHED_FRACTION)
            .map(([day]) => day)
            .filter((day) => {
              const before = daysBetween(day, markDay);
              return before >= 0 && before <= COMPANION_WINDOW_DAYS;
            })
            .sort()
            .at(-1);
    if (found === undefined) {
      days.set(itemId, []);
      counts.undated += 1;
    } else {
      days.set(itemId, [found]);
      counts.dated += 1;
    }
  }
  return { days, counts };
}
