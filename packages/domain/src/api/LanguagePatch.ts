import type { Language } from './Language.js';

/** The signed-in user's own language: `null` follows the browser. */
export interface LanguagePatch {
  language: Language | null;
}
