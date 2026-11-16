const DAY_MS = 86_400_000;

/** The local calendar date of a moment as `YYYY-MM-DD`. */
export function localDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** `date` moved by `days`. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** `month` (`YYYY-MM`) moved by `months`. */
export function addMonths(month: string, months: number): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const moved = new Date(Date.UTC(year, index - 1 + months, 1));
  return moved.toISOString().slice(0, 7);
}
