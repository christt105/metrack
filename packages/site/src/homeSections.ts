import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';

export interface HomeSection {
  id: string;
  title: string;
  entries: PublicEntry[];
}

/** The lists on the home page, one per type of item. A series appears through its seasons, or by itself when it has none. */
export function homeSections(library: Library): HomeSection[] {
  const withSeasons = new Set(library.seasons.map((season) => season.seriesId));
  const lonelySeries = library.series.filter((series) => !withSeasons.has(series.id));
  return [
    { id: 'peliculas', title: 'Películas', entries: library.movies },
    { id: 'series', title: 'Series', entries: [...library.seasons, ...lonelySeries] },
    { id: 'juegos', title: 'Juegos', entries: library.videogames },
    { id: 'libros', title: 'Libros', entries: library.books },
  ].filter((section) => section.entries.length > 0);
}
