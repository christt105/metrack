import type { SiteMessages } from './messages/SiteMessages.js';

/** A whole number written the way the language does. */
export function formatInteger(value: number, messages: SiteMessages): string {
  return new Intl.NumberFormat(messages.numberLocale, { maximumFractionDigits: 0 }).format(value);
}
