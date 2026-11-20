import type { Language } from './Language.js';

/**
 * What a signed-in user changes about their own settings. `language` of `null` follows the browser. `steamId` is a
 * SteamID64, a profile address or a vanity name; `null` or an empty text unlinks the account.
 */
export interface SelfSettingsPatch {
  language?: Language | null;
  steamId?: string | null;
}
