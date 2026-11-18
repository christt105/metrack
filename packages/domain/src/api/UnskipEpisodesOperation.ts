/** Takes the episodes out of the skipped ones; they are then expected again. */
export interface UnskipEpisodesOperation {
  op: 'unskip';
  keys: string[];
}
