import { ratingLevel } from '@metrack/domain';
import type { Messages } from '../i18n/messages/Messages';
import type { AppIconName } from './AppIconName';

/** What the web shows for a stored rating: an icon, a word and a colour. */
export interface RatingDisplay {
  icon: AppIconName;
  label: string;
  color: string;
}

const NEUTRAL_COLOR = 'var(--muted)';

/** The icon, word and colour of a rating; a value outside the 1 to 7 scale gets a neutral look. */
export function ratingDisplay(rating: number, messages: Messages): RatingDisplay {
  const level = ratingLevel(rating);
  if (!level) return { icon: 'star', label: messages.ratingPicker.other, color: NEUTRAL_COLOR };
  return { icon: level.icon, label: messages.ratings[level.icon], color: level.color };
}
