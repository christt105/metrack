import type { Artwork } from './Artwork.js';
import type { Tracking } from './Tracking.js';

export interface Movie extends Tracking, Artwork {
  id: number;
  tmdbId: number | null;
  jellyfinId: string | null;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  overview: string | null;
  genres: string[];
  cast: string[];
  director: string | null;
  note: string | null;
  /** File name the item had in the vault. It keeps exported page addresses stable. */
  slug: string | null;
  tags: string[];
}
