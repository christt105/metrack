/** Adds a viewing finished on `date` to each episode; a null date marks them watched on an unknown date. */
export interface MarkEpisodesOperation {
  op: 'mark';
  numbers: number[];
  date: string | null;
}
