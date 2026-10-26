import type { PlayRecord } from './PlayRecord.js';
import { WATCHED_FRACTION } from './WATCHED_FRACTION.js';

/**
 * Groups playback by item and returns, for each item, the sorted dates on which it was watched.
 * An item counts as watched on a day when the time played that day reaches 90% of its runtime;
 * with an unknown runtime any playback counts. An item the media server marks as played but that never reaches 90%
 * on a single day (skipped intros and credits) counts on the day with the most playback. Playback of unlisted items is ignored and counted in `ignored`.
 */
export function collectWatchDays(
  plays: readonly PlayRecord[],
  runtimes: ReadonlyMap<string, number | null>,
  dateOf: (iso: string) => string,
  played: ReadonlySet<string> = new Set(),
): {
  days: Map<string, string[]>;
  playCount: Map<string, number>;
  ignored: number;
  unmatched: Map<string, number>;
} {
  const seconds = new Map<string, Map<string, number>>();
  const playCount = new Map<string, number>();
  const unmatched = new Map<string, number>();
  let ignored = 0;
  for (const play of plays) {
    if (!runtimes.has(play.itemId)) {
      ignored += 1;
      const title = play.title ?? 'Unknown';
      unmatched.set(title, (unmatched.get(title) ?? 0) + 1);
      continue;
    }
    const perDay = seconds.get(play.itemId) ?? new Map<string, number>();
    const day = dateOf(play.playedAt);
    perDay.set(day, (perDay.get(day) ?? 0) + play.watchedSeconds);
    seconds.set(play.itemId, perDay);
    playCount.set(play.itemId, (playCount.get(play.itemId) ?? 0) + 1);
  }
  const days = new Map<string, string[]>();
  for (const [itemId, perDay] of seconds) {
    const runtime = runtimes.get(itemId) ?? null;
    const watched = [...perDay]
      .filter(([, total]) => runtime === null || total >= runtime * WATCHED_FRACTION)
      .map(([day]) => day)
      .sort();
    if (watched.length === 0 && played.has(itemId)) {
      const [longest] = [...perDay].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));
      if (longest) watched.push(longest[0]);
    }
    if (watched.length > 0) days.set(itemId, watched);
  }
  return { days, playCount, ignored, unmatched };
}
