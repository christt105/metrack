/** One cell of a month grid. */
export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  date: string;
  day: number;
  inMonth: boolean;
}
