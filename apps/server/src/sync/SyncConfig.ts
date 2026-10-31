import type { JellyfinConfig } from './JellyfinConfig.js';
import type { JellystatConfig } from './JellystatConfig.js';

export interface SyncConfig {
  jellyfin: JellyfinConfig;
  jellystat: JellystatConfig;
  /** Jellyfin account whose viewings are tracked. */
  userName: string;
  /** IANA time zone that decides on which day a viewing falls. */
  timeZone: string;
  /** Quiet time after a Jellyfin webhook before the sync runs, so Jellystat has recorded the playback. */
  webhookDelayMs: number;
}
