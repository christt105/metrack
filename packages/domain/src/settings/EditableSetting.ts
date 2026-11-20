import type { UserSettings } from '../api/UserSettings.js';

/** The settings the owner changes for other users: every one but the language and the Steam account, which each user sets for themselves. */
export type EditableSetting = Exclude<keyof UserSettings, 'language' | 'steamId'>;
