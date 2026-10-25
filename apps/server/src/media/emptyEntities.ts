import type { Book, Movie, Season, Series, Tracking, Videogame } from '@metrack/domain';

function emptyTracking(): Tracking {
  return {
    status: 'planned',
    startedAt: null,
    finishedAt: null,
    rating: null,
    review: null,
    rewatches: [],
  };
}

export function emptyMovie(): Omit<Movie, 'id'> {
  return {
    tmdbId: null,
    jellyfinId: null,
    title: '',
    originalTitle: null,
    releaseDate: null,
    overview: null,
    genres: [],
    cast: [],
    director: null,
    note: null,
    slug: null,
    tags: [],
    cover: null,
    banner: null,
    ...emptyTracking(),
  };
}

export function emptySeries(): Omit<Series, 'id'> {
  return {
    tmdbId: null,
    tvdbId: null,
    jellyfinId: null,
    title: '',
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
  };
}

export function emptySeason(): Omit<Season, 'id'> {
  return {
    seriesId: 0,
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
    ...emptyTracking(),
  };
}

export function emptyVideogame(): Omit<Videogame, 'id'> {
  return {
    igdbId: null,
    steamAppId: null,
    steamGridDbId: null,
    title: '',
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
    ...emptyTracking(),
  };
}

export function emptyBook(): Omit<Book, 'id'> {
  return {
    openLibraryId: null,
    isbn: null,
    title: '',
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
    ...emptyTracking(),
  };
}
