import type { Tracking } from './Tracking.js';

export interface Book extends Tracking {
  id: number;
  openLibraryId: string | null;
  isbn: string | null;
  title: string;
  authors: string[];
  publisher: string | null;
  pageCount: number | null;
  releaseDate: string | null;
  overview: string | null;
  genres: string[];
  cover: string | null;
  note: string | null;
  /** File name the item had in the vault. It keeps exported page addresses stable. */
  slug: string | null;
  tags: string[];
}
