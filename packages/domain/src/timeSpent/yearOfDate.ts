/** The year of an ISO `YYYY-MM-DD` date; null when there is no date. */
export function yearOfDate(date: string | null | undefined): string | null {
  return date ? date.slice(0, 4) : null;
}
