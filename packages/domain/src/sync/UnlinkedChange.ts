/** A watched library title without any usable external id. It waits in the unlinked inbox. */
export interface UnlinkedChange {
  mediaType: 'movie' | 'series';
  jellyfinId: string;
  title: string;
  year: number | null;
  plays: number;
}
