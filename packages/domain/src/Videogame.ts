import type { Artwork } from './Artwork.js';
import type { Tracking } from './Tracking.js';

export interface Videogame extends Tracking, Artwork {
  id: number;
  igdbId: number | null;
  steamAppId: string | null;
  steamGridDbId: number | null;
  title: string;
  releaseDate: string | null;
  overview: string | null;
  genres: string[];
  developer: string | null;
  platforms: string[];
  note: string | null;
  /** File name the item had in the vault. It keeps exported page addresses stable. */
  slug: string | null;
  tags: string[];
}
