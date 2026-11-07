import type { JellyfinConfig } from './JellyfinConfig.js';
import type { JellystatConfig } from './JellystatConfig.js';

/** The Jellyfin server and Jellystat database every user's sync reads; each user names their own Jellyfin account. */
export interface SyncConfig {
  jellyfin: JellyfinConfig;
  jellystat: JellystatConfig;
  /** IANA time zone that decides on which day a viewing falls. */
  timeZone: string;
  /** Quiet time after a Jellyfin webhook before the sync runs, so Jellystat has recorded the playback. */
  webhookDelayMs: number;
}
