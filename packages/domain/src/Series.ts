import type { Artwork } from './Artwork.js';

/** Groups seasons and holds descriptive metadata. It carries no viewing data. */
export interface Series extends Artwork {
  id: number;
  tmdbId: number | null;
  tvdbId: number | null;
  jellyfinId: string | null;
  title: string;
  originalTitle: string | null;
  firstAirDate: string | null;
  overview: string | null;
  genres: string[];
  cast: string[];
  follow: boolean;
  note: string | null;
}
