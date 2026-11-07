/** The four-digit year at the start of an ISO date, or null. */
export function yearOf(date: string | null): string | null {
  return date !== null && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
}
