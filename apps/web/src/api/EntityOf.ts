import type { Book, Movie, Season, Series, Videogame } from '@metrack/domain';

/** The entity type stored behind each API collection. */
export interface EntityOf {
  movies: Movie;
  series: Series;
  seasons: Season;
  games: Videogame;
  books: Book;
}
