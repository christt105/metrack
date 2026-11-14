/** How many alerts the connector sent on one UTC day. */
export interface DailySent {
  /** `YYYY-MM-DD` in UTC, empty before the first alert. */
  day: string;
  count: number;
}
