import { normalizePlatforms } from './normalizePlatforms.js';

/** The platforms of a game imported from a Steam library: a Steam Deck entry is the PC the library belongs to. */
export function steamPlatforms(names: readonly string[]): string[] {
  return normalizePlatforms(
    names.map((name) => (name.trim().toLowerCase() === 'steam deck' ? 'PC' : name)),
  );
}
