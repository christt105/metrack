import { inject } from 'vue';
import type { Locale } from '../i18n/Locale';
import { localeKey } from '../i18n/localeKey';

/** The locale provided by the app root. */
export function useLocale(): Locale {
  const locale = inject(localeKey);
  if (!locale) throw new Error('Locale was not provided');
  return locale;
}
