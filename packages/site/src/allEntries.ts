import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';

export function allEntries(library: Library): PublicEntry[] {
  return [
    ...library.movies,
    ...library.series,
    ...library.seasons,
    ...library.videogames,
    ...library.books,
  ];
}
