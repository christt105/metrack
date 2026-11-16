import type { WatchlistEntry } from '@metrack/domain';
import type { FollowingEvent } from './FollowingEvent';

/**
 * The dated releases among the followed titles, oldest first: each movie's premiere, and each series' next episode or,
 * when none is known, the first air date of its newest season.
 */
export function followingEvents(entries: readonly WatchlistEntry[]): FollowingEvent[] {
  const events: FollowingEvent[] = [];
  for (const entry of entries) {
    const date = entry.nextEpisode?.airDate ?? entry.releaseDate;
    if (date) events.push({ key: `${entry.type}-${entry.id}`, entry, date });
  }
  return events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.entry.title.localeCompare(b.entry.title),
  );
}
