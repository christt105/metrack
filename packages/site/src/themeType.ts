import type { IconName } from './IconName.js';
import type { PublicKind } from './PublicKind.js';

export type ThemeType = 'movie' | 'tv' | 'season' | 'videogame' | 'book';

/** The name the pages give a kind of item: a series is `tv`. */
export function themeType(kind: PublicKind): ThemeType {
  return kind === 'series' ? 'tv' : kind;
}

/** The icon of each type. */
export const TYPE_ICONS: Record<ThemeType, IconName> = {
  movie: 'movie',
  tv: 'tv',
  season: 'tv',
  videogame: 'videogame',
  book: 'book',
};
