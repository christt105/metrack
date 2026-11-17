/** A movie to create (`movieId` null) or update from its viewings. Tracking fields hold the final values. */
export interface MovieChange {
  action: 'create' | 'complete' | 'rewatch';
  movieId: number | null;
  jellyfinId: string;
  tmdbId: number;
  title: string;
  year: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** Finish dates of every closed viewing after the first, as plain dates so older connectors keep working. */
  rewatches: string[];
  missingRating: boolean;
}
