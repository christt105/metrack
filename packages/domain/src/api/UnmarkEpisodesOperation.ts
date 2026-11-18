/** Removes the episodes from the watched ones, with all their viewings. */
export interface UnmarkEpisodesOperation {
  op: 'unmark';
  numbers: number[];
}
