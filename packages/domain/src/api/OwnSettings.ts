import type { PublicPage } from './PublicPage.js';
import type { UserSettings } from './UserSettings.js';

/** The signed-in user's settings and public page, and whether they are the owner who can change everyone's. */
export interface OwnSettings {
  settings: UserSettings;
  publicPage: PublicPage;
  owner: boolean;
}
