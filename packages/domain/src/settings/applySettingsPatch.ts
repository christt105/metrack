import type { UserSettings } from '../api/UserSettings.js';
import type { UserSettingsPatch } from '../api/UserSettingsPatch.js';
import type { SettingsPatchResult } from './SettingsPatchResult.js';
import { settingProblem } from './settingProblem.js';

/** Applies a patch to stored settings: values are trimmed, an empty one clears the setting, and every value is checked. */
export function applySettingsPatch(
  current: UserSettings,
  patch: UserSettingsPatch,
): SettingsPatchResult {
  const settings: UserSettings = { ...current };
  const problems: Partial<Record<keyof UserSettings, string>> = {};
  for (const [key, raw] of Object.entries(patch) as [
    keyof UserSettings,
    string | null | undefined,
  ][]) {
    if (raw === undefined) continue;
    const value = raw === null ? '' : raw.trim();
    const problem = value === '' ? null : settingProblem(key, value);
    if (problem) problems[key] = problem;
    else settings[key] = value === '' ? null : value;
  }
  return Object.keys(problems).length > 0 ? { ok: false, problems } : { ok: true, settings };
}
