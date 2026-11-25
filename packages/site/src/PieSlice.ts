/** One part of a pie on the statistics page. */
export interface PieSlice {
  name: string;
  count: number;
  color: string;
  /** The share written in the legend; defaults to the rounded share of the total. */
  percent?: number;
}
