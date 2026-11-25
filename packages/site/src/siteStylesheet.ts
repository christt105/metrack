import { RATING_LEVELS } from '@metrack/domain';
import { SITE_CSS } from './assets/SITE_CSS.js';

/** The stylesheet of the public pages with one `rating-<n>` class per level of the rating scale, so ratings are painted without inline styles. */
export function siteStylesheet(): string {
  const ratings = RATING_LEVELS.map(
    (level) => `.rating-${level.rating} { --rating: ${level.color}; }`,
  );
  return `${SITE_CSS}\n.rating-0 { --rating: #8e948d; }\n${ratings.join('\n')}\n`;
}
