import type { AlertKey } from '@metrack/domain';
import type { FollowedTitle } from './FollowedTitle.js';

/** Everything the connector needs to check one user's followed titles, read in one go. */
export interface ReleaseState {
  /** The user's ntfy topic, which alerts are published to. */
  ntfyTopic: string;
  /** Followed series that have a TMDB id. */
  series: FollowedTitle[];
  /** Followed movies that have a TMDB id. */
  movies: FollowedTitle[];
  /** The keys of the alerts already recorded, which are never sent again. */
  alerts: AlertKey[];
}
