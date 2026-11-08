import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';

/** What the library home lists: movies, games and books, and series through their seasons or by themselves when they have none. */
export function homeEntries(library: Library): PublicEntry[] {
  const withSeasons = new Set(library.seasons.map((season) => season.seriesId));
  const lonelySeries = library.series.filter((series) => !withSeasons.has(series.id));
  return [
    ...library.movies,
    ...library.seasons,
    ...lonelySeries,
    ...library.videogames,
    ...library.books,
  ];
}
