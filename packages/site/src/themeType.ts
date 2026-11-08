import type { PublicKind } from './PublicKind.js';

export type ThemeType = 'movie' | 'tv' | 'season' | 'videogame' | 'book';

/** The name the theme gives a kind of item: a series is `tv`. */
export function themeType(kind: PublicKind): ThemeType {
  return kind === 'series' ? 'tv' : kind;
}

/** Font Awesome classes of the icon of each type. */
export const TYPE_ICONS: Record<ThemeType, string> = {
  movie: 'fas fa-film',
  tv: 'fas fa-tv',
  season: 'fas fa-tv',
  videogame: 'fas fa-gamepad',
  book: 'fas fa-book',
};
