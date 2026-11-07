import type { Book, Movie, Season, Series, Tracking, Videogame } from '@metrack/domain';
import type { SiteInput } from '../src/SiteInput.js';

const tracking: Tracking = {
  status: 'planned',
  startedAt: null,
  finishedAt: null,
  rating: null,
  review: null,
  rewatches: [],
  pendingReview: false,
};

export const HASH_A = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);

export function movie(overrides: Partial<Movie> & { id: number }): Movie {
  return {
    ...tracking,
    tmdbId: null,
    jellyfinId: null,
    title: `Movie ${overrides.id}`,
    originalTitle: null,
    releaseDate: null,
    overview: null,
    genres: [],
    cast: [],
    director: null,
    follow: false,
    note: null,
    slug: null,
    tags: [],
    cover: null,
    banner: null,
    ...overrides,
  };
}

export function series(overrides: Partial<Series> & { id: number }): Series {
  return {
    tmdbId: null,
    tvdbId: null,
    jellyfinId: null,
    title: `Series ${overrides.id}`,
    originalTitle: null,
    firstAirDate: null,
    overview: null,
    genres: [],
    cast: [],
    follow: false,
    note: null,
    slug: null,
    tags: [],
    review: null,
    cover: null,
    banner: null,
    ...overrides,
  };
}

export function season(overrides: Partial<Season> & { id: number; seriesId: number }): Season {
  return {
    ...tracking,
    number: 1,
    tmdbSeasonNumber: null,
    jellyfinId: null,
    title: null,
    overview: null,
    firstAirDate: null,
    episodeCount: null,
    slug: null,
    tags: [],
    cover: null,
    banner: null,
    ...overrides,
  };
}

export function game(overrides: Partial<Videogame> & { id: number }): Videogame {
  return {
    ...tracking,
    igdbId: null,
    steamAppId: null,
    steamGridDbId: null,
    title: `Game ${overrides.id}`,
    releaseDate: null,
    overview: null,
    genres: [],
    developer: null,
    platforms: [],
    note: null,
    slug: null,
    tags: [],
    cover: null,
    banner: null,
    ...overrides,
  };
}

export function book(overrides: Partial<Book> & { id: number }): Book {
  return {
    ...tracking,
    openLibraryId: null,
    isbn: null,
    title: `Book ${overrides.id}`,
    authors: [],
    publisher: null,
    pageCount: null,
    releaseDate: null,
    overview: null,
    genres: [],
    cover: null,
    note: null,
    slug: null,
    tags: [],
    ...overrides,
  };
}

export function input(overrides: Partial<SiteInput> = {}): SiteInput {
  return {
    handle: 'ana',
    movies: [],
    series: [],
    seasons: [],
    videogames: [],
    books: [],
    ...overrides,
  };
}
