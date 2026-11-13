import type { PublicPage } from './PublicPage.js';
import type { UserSettings } from './UserSettings.js';

/**
 * The signed-in user's settings and public page, and whether they are the owner who can change everyone's.
 * `ntfyTopicGenerated` is true when the server creates the ntfy topic (the user turns alerts on, regenerates or turns
 * them off) instead of the owner typing it.
 */
export interface OwnSettings {
  settings: UserSettings;
  publicPage: PublicPage;
  owner: boolean;
  ntfyTopicGenerated: boolean;
}
