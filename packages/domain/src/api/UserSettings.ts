/** What a user's background jobs act on. A job runs only for users who set what it needs. */
export interface UserSettings {
  /** Jellyfin account whose viewings are synced. */
  jellyfinUser: string | null;
  /** ntfy topic for release alerts and failures of this user's jobs. */
  ntfyTopic: string | null;
  /** Cloudflare Pages project this user's site is published to. */
  publishProject: string | null;
  /** Public address of that site, for feeds and canonical links. */
  publishBaseUrl: string | null;
  /** Folder the read-only notes are mirrored into. */
  mirrorDir: string | null;
  /** That folder's path inside the vault, for `[[...]]` links. Defaults to "Media Tracker". */
  mirrorLinkPrefix: string | null;
}
