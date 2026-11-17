import type { RatingLevel } from './RatingLevel.js';

/** The rating scale, from the best level to the worst. Ratings are stored as integers 1 to 7. */
export const RATING_LEVELS: readonly RatingLevel[] = [
  { rating: 7, color: '#a855f7', icon: 'crown' },
  { rating: 6, color: '#22c55e', icon: 'heart' },
  { rating: 5, color: '#84cc16', icon: 'thumbsUp' },
  { rating: 4, color: '#eab308', icon: 'smile' },
  { rating: 3, color: '#f97316', icon: 'thumbsDown' },
  { rating: 2, color: '#ef4444', icon: 'dizzy' },
  { rating: 1, color: '#b91c1c', icon: 'skull' },
];

export const RATING_MIN = 1;
export const RATING_MAX = 7;

/** The level of a stored rating, or null for anything outside the 1 to 7 scale. */
export function ratingLevel(rating: number): RatingLevel | null {
  return RATING_LEVELS.find((level) => level.rating === rating) ?? null;
}
