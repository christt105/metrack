import type { SiteMessages } from './messages/SiteMessages.js';
import { formatDecimal } from './formatDecimal.js';
import { formatInteger } from './formatInteger.js';

/** Minutes as hours with the unit: one decimal below 100 hours, whole hours from there. */
export function formatHours(minutes: number, messages: SiteMessages): string {
  const hours = minutes / 60;
  const text = hours < 100 ? formatDecimal(hours, messages) : formatInteger(hours, messages);
  return `${text} ${messages.stats.hoursUnit}`;
}
