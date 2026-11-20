import type { SiteMessages } from './messages/SiteMessages.js';

/** A number with one decimal, written the way the language does ("7,5", "7.5"). */
export function formatDecimal(value: number, messages: SiteMessages): string {
  return new Intl.NumberFormat(messages.numberLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
