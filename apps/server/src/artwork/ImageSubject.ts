import type { Book, Movie, Season, Series, Videogame } from '@metrack/domain';

/** The entity artwork is wanted for, with the series a season belongs to. */
export type ImageSubject =
  | { type: 'movie'; entity: Movie }
  | { type: 'series'; entity: Series }
  | { type: 'season'; entity: Season; series: Series }
  | { type: 'videogame'; entity: Videogame }
  | { type: 'book'; entity: Book };
