import type { SiteMessages } from './messages/SiteMessages.js';

/** An ISO `YYYY-MM-DD` date as "7 nov 2026"; anything else is returned as it came. */
export function formatDate(date: string, messages: SiteMessages): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const month = match ? messages.months[Number(match[2]) - 1] : undefined;
  return match && month ? `${Number(match[3])} ${month} ${match[1]}` : date;
}
