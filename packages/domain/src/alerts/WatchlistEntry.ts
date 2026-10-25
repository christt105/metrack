/** A followed movie or series. A series shows the first air date of its newest season. */
export interface WatchlistEntry {
  type: 'movie' | 'series';
  id: number;
  title: string;
  cover: string | null;
  releaseDate: string | null;
}
