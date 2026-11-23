import type { Artwork } from '../Artwork.js';

/** The series of a row of the next-episode list. */
export interface NextEpisodeSeries extends Artwork {
  id: number;
  title: string;
}
