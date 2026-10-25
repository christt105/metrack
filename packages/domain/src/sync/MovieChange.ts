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
  rewatches: string[];
  missingRating: boolean;
}
