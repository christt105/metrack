export interface RatingTheme {
  label: string;
  color: string;
}

const THEMES: Record<number, RatingTheme> = {
  7: { label: 'Obra Maestra', color: '#a855f7' },
  6: { label: 'Increíble', color: '#22c55e' },
  5: { label: 'Bueno', color: '#84cc16' },
  4: { label: 'Decente', color: '#eab308' },
  3: { label: 'Malo', color: '#f97316' },
  2: { label: 'Terrible', color: '#ef4444' },
  1: { label: 'Abismal', color: '#b91c1c' },
};

/** The label and colour of a rating on the 1 to 7 scale; anything else gets a neutral colour. */
export function ratingTheme(rating: number): RatingTheme {
  return THEMES[rating] ?? { label: String(rating), color: '#cccccc' };
}
