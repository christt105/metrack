const DAY_MS = 86_400_000;

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}
