import type { Language } from './Language.js';

/** What a user's background jobs act on. A job runs only for users who set what it needs. */
export interface UserSettings {
  /** Jellyfin account whose viewings are synced. */
  jellyfinUser: string | null;
  /** ntfy topic for release alerts and failures of this user's jobs. */
  ntfyTopic: string | null;
  /** Folder the read-only notes are mirrored into. */
  mirrorDir: string | null;
  /** That folder's path inside the vault, for `[[...]]` links. Defaults to "Media Tracker". */
  mirrorLinkPrefix: string | null;
  /** Interface language the user chose, `null` to follow the browser. */
  language: Language | null;
  /** SteamID64 of the Steam account whose library is imported, `null` when none is linked. */
  steamId: string | null;
}
