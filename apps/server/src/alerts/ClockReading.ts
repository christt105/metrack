/** A moment as seen on a wall clock. */
export interface ClockReading {
  /** `YYYY-MM-DD` */
  date: string;
  /** 0 to 23 */
  hour: number;
}
