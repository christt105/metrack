import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import type { PublicKind } from './PublicKind.js';

const COLLECTIONS: Record<PublicKind, (library: Library) => PublicEntry[]> = {
  movie: (library) => library.movies,
  series: (library) => library.series,
  season: (library) => library.seasons,
  videogame: (library) => library.videogames,
  book: (library) => library.books,
};

export function isPublicKind(value: string): value is PublicKind {
  return Object.hasOwn(COLLECTIONS, value);
}

export function findEntry(library: Library, kind: PublicKind, id: number): PublicEntry | undefined {
  return COLLECTIONS[kind](library).find((entry) => entry.id === id);
}
