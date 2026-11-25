/** One row of a bar chart on the statistics page. */
export interface StatBar {
  /** Already escaped markup for the name. */
  name: string;
  /** Share of the full track, 0 to 100. */
  percent: number;
  value: string;
  /** Fill of the bar; the accent colour without one. */
  color?: string;
  /** Class that paints the value, such as a rating's. */
  valueClass?: string;
}
