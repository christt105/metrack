/** Adds a viewing that starts and ends on `date` to each episode; a null date marks them watched on an unknown date. */
export interface MarkEpisodesOperation {
  op: 'mark';
  keys: string[];
  date: string | null;
}
