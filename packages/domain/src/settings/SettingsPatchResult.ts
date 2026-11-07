import type { UserSettings } from '../api/UserSettings.js';

export type SettingsPatchResult =
  | { ok: true; settings: UserSettings }
  | { ok: false; problems: Partial<Record<keyof UserSettings, string>> };
