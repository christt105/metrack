import type { RatingIcon } from './RatingIcon.js';

/** One step of the rating scale: the stored integer, its colour and its icon. */
export interface RatingLevel {
  rating: number;
  color: string;
  icon: RatingIcon;
}
