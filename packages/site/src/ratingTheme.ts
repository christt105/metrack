import { RATING_LEVELS, type RatingIcon } from '@metrack/domain';
import type { SiteMessages } from './messages/SiteMessages.js';

export interface RatingTheme {
  label: string;
  color: string;
  /** Font Awesome classes of the rating's icon. */
  icon: string;
}

const FONT_AWESOME: Record<RatingIcon, string> = {
  crown: 'fa-solid fa-crown',
  heart: 'fa-solid fa-heart',
  thumbsUp: 'fa-solid fa-thumbs-up',
  smile: 'fa-solid fa-face-smile',
  thumbsDown: 'fa-solid fa-thumbs-down',
  dizzy: 'fa-solid fa-face-dizzy',
  skull: 'fa-solid fa-skull',
};

/** The rating scale, from the best rating to the worst. */
export function ratingScale(messages: SiteMessages): (RatingTheme & { rating: number })[] {
  return RATING_LEVELS.map((level) => ({
    rating: level.rating,
    label: messages.ratingLabels[level.icon],
    color: level.color,
    icon: FONT_AWESOME[level.icon],
  }));
}

const DEFAULT_THEME: RatingTheme = { label: '', color: '#cccccc', icon: 'fa-solid fa-star' };

/** The label, colour and icon of a rating on the 1 to 7 scale; anything else gets a neutral look. */
export function ratingTheme(rating: number, messages: SiteMessages): RatingTheme {
  const theme = ratingScale(messages).find((entry) => entry.rating === rating);
  return theme ?? { ...DEFAULT_THEME, label: String(rating) };
}
