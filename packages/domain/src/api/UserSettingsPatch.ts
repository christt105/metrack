import type { UserSettings } from './UserSettings.js';

/** Some of a user's settings to change; `null` or an empty string clears one. */
export type UserSettingsPatch = Partial<
  Record<Exclude<keyof UserSettings, 'language'>, string | null>
>;
