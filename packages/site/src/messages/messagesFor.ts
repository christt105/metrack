import type { Language } from '@metrack/domain';
import { en } from './en.js';
import { es } from './es.js';
import type { SiteMessages } from './SiteMessages.js';

/** The dictionary of a language; no language (the owner never chose one) is Spanish. */
export function messagesFor(language: Language | null): SiteMessages {
  return language === 'en' ? en : es;
}
