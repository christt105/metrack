import type { Language } from '@metrack/domain';
import type { SteamLanguage } from './SteamLanguage.js';

export function toSteamLanguage(language: Language | null | undefined): SteamLanguage {
  return language === 'es' ? 'spanish' : 'english';
}
