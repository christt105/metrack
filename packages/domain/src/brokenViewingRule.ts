import type { Viewing } from './Viewing.js';
import type { ViewingRuleBroken } from './ViewingRuleBroken.js';

function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/**
 * The first rule a list of viewings breaks, or null when it can be stored. A viewing must not start after it
 * finishes, no date (abandonment included) may be later than the day after `today`, which leaves room for time
 * zones ahead of the one `today` was read in, and two dated viewings of the same kind (live, or abandoned on the
 * same day) must not be identical. Viewings with no date at all may repeat: each one is a watch on an unknown date.
 */
export function brokenViewingRule(
  viewings: readonly Viewing[],
  today: string,
): ViewingRuleBroken | null {
  const limit = nextDay(today);
  const seen = new Set<string>();
  for (const { startedAt, finishedAt, abandonedAt } of viewings) {
    if (startedAt !== null && finishedAt !== null && startedAt > finishedAt) return 'invalid_dates';
    if ([startedAt, finishedAt, abandonedAt].some((date) => date != null && date > limit)) {
      return 'future_date';
    }
    if (startedAt === null && finishedAt === null) continue;
    const id = `${abandonedAt ?? ''}|${startedAt ?? ''}|${finishedAt ?? ''}`;
    if (seen.has(id)) return 'duplicate';
    seen.add(id);
  }
  return null;
}
