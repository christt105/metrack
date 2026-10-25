import type { MediaType } from '../MediaType.js';

export const COLLECTIONS = ['movies', 'series', 'seasons', 'games', 'books'] as const;

/** URL segment of an entity collection, for example `/api/movies/12`. */
export type Collection = (typeof COLLECTIONS)[number];

export const MEDIA_TYPE_OF_COLLECTION: Record<Collection, MediaType> = {
  movies: 'movie',
  series: 'series',
  seasons: 'season',
  games: 'videogame',
  books: 'book',
};
