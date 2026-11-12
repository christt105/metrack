/** UTC date as YYYY-MM-DD. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** First day of the UTC month as YYYY-MM-01. */
export function utcMonthStart(now: Date): string {
  return `${now.toISOString().slice(0, 7)}-01`;
}
