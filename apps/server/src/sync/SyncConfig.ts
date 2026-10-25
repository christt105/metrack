import type { JellyfinConfig } from './JellyfinConfig.js';
import type { JellystatConfig } from './JellystatConfig.js';

export interface SyncConfig {
  jellyfin: JellyfinConfig;
  jellystat: JellystatConfig;
  /** Jellyfin account whose viewings are tracked. */
  userName: string;
  /** IANA time zone that decides on which day a viewing falls. */
  timeZone: string;
}
