import type { WatchlistEntry } from '@metrack/domain';

/** A dated release of something followed: the next episode of a series or the premiere of a movie. */
export interface FollowingEvent {
  key: string;
  entry: WatchlistEntry;
  /** `YYYY-MM-DD`. */
  date: string;
}
