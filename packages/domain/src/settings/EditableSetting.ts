import type { UserSettings } from '../api/UserSettings.js';

/** The settings the owner changes for other users: every one but the language, which each user sets for themselves. */
export type EditableSetting = Exclude<keyof UserSettings, 'language'>;
