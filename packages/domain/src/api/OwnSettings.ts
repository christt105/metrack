import type { UserSettings } from './UserSettings.js';

/** The signed-in user's settings, and whether they are the owner who can change everyone's. */
export interface OwnSettings {
  settings: UserSettings;
  owner: boolean;
}
