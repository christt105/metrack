/** Folder name of every page, by entity id. Seasons that have no page of their own are absent. */
export interface Slugs {
  movies: Map<number, string>;
  series: Map<number, string>;
  seasons: Map<number, string>;
  videogames: Map<number, string>;
  books: Map<number, string>;
  /** Every name in use, for resolving links. */
  all: ReadonlySet<string>;
}
