/**
 * Minutes spent on an item. `byYear` splits the part that has a date by calendar year (`YYYY`), so it never sums to more than `minutes`; undated viewings only count in `minutes`.
 */
export interface TimeSpent {
  minutes: number;
  byYear: Record<string, number>;
}
