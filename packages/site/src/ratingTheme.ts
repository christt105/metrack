import { RATING_LEVELS } from '@metrack/domain';
import type { IconName } from './IconName.js';
import type { SiteMessages } from './messages/SiteMessages.js';

export interface RatingTheme {
  label: string;
  color: string;
  icon: IconName;
}

/** The rating scale, from the best rating to the worst. */
export function ratingScale(messages: SiteMessages): (RatingTheme & { rating: number })[] {
  return RATING_LEVELS.map((level) => ({
    rating: level.rating,
    label: messages.ratingLabels[level.icon],
    color: level.color,
    icon: level.icon,
  }));
}

const DEFAULT_THEME: RatingTheme = { label: '', color: '#cccccc', icon: 'star' };

/** The label, colour and icon of a rating on the 1 to 7 scale; anything else gets a neutral look. */
export function ratingTheme(rating: number, messages: SiteMessages): RatingTheme {
  const theme = ratingScale(messages).find((entry) => entry.rating === rating);
  return theme ?? { ...DEFAULT_THEME, label: String(rating) };
}

/** The class that paints an element in the colour of a rating, `rating-0` outside the scale. */
export function ratingClass(rating: number | null): string {
  const known = rating !== null && RATING_LEVELS.some((level) => level.rating === rating);
  return `rating-${known ? rating : 0}`;
}
