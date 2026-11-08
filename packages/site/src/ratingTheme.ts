export interface RatingTheme {
  label: string;
  color: string;
  /** Font Awesome classes of the rating's icon. */
  icon: string;
}

/** The rating scale, from the best rating to the worst. */
export const RATING_SCALE: readonly (RatingTheme & { rating: number })[] = [
  { rating: 7, label: 'Obra Maestra', color: '#a855f7', icon: 'fa-solid fa-crown' },
  { rating: 6, label: 'Increíble', color: '#22c55e', icon: 'fa-solid fa-heart' },
  { rating: 5, label: 'Bueno', color: '#84cc16', icon: 'fa-solid fa-thumbs-up' },
  { rating: 4, label: 'Decente', color: '#eab308', icon: 'fa-solid fa-face-smile' },
  { rating: 3, label: 'Malo', color: '#f97316', icon: 'fa-solid fa-thumbs-down' },
  { rating: 2, label: 'Terrible', color: '#ef4444', icon: 'fa-solid fa-face-dizzy' },
  { rating: 1, label: 'Abismal', color: '#b91c1c', icon: 'fa-solid fa-skull' },
];

const DEFAULT_THEME: RatingTheme = { label: '', color: '#cccccc', icon: 'fa-solid fa-star' };

/** The label, colour and icon of a rating on the 1 to 7 scale; anything else gets a neutral look. */
export function ratingTheme(rating: number): RatingTheme {
  const theme = RATING_SCALE.find((entry) => entry.rating === rating);
  return theme ?? { ...DEFAULT_THEME, label: String(rating) };
}
