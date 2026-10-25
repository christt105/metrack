import { MEDIA_STATUSES, type Collection } from '@metrack/domain';
import {
  DATE_PATTERN,
  nullableDate,
  nullableInteger,
  nullableString,
  stringList,
  title,
} from './fieldTypes.js';

type Properties = Record<string, object>;

const tracking: Properties = {
  status: { enum: [...MEDIA_STATUSES] },
  startedAt: nullableDate,
  finishedAt: nullableDate,
  rating: { type: ['number', 'null'], minimum: 0, maximum: 10 },
  review: nullableString,
  rewatches: { type: 'array', items: { type: 'string', pattern: DATE_PATTERN } },
};

const common: Properties = { slug: nullableString, tags: stringList };

/** Editable fields of each collection. Images are changed through the image routes. */
export const MEDIA_PROPERTIES: Record<Collection, Properties> = {
  movies: {
    ...common,
    ...tracking,
    tmdbId: nullableInteger,
    jellyfinId: nullableString,
    title,
    originalTitle: nullableString,
    releaseDate: nullableDate,
    overview: nullableString,
    genres: stringList,
    cast: stringList,
    director: nullableString,
    note: nullableString,
  },
  series: {
    ...common,
    tmdbId: nullableInteger,
    tvdbId: nullableInteger,
    jellyfinId: nullableString,
    title,
    originalTitle: nullableString,
    firstAirDate: nullableDate,
    overview: nullableString,
    genres: stringList,
    cast: stringList,
    follow: { type: 'boolean' },
    note: nullableString,
    review: nullableString,
  },
  seasons: {
    ...common,
    ...tracking,
    number: { type: 'integer', minimum: 0 },
    tmdbSeasonNumber: nullableInteger,
    jellyfinId: nullableString,
    title: nullableString,
    overview: nullableString,
    firstAirDate: nullableDate,
    episodeCount: nullableInteger,
  },
  games: {
    ...common,
    ...tracking,
    igdbId: nullableInteger,
    steamAppId: nullableString,
    steamGridDbId: nullableInteger,
    title,
    releaseDate: nullableDate,
    overview: nullableString,
    genres: stringList,
    developer: nullableString,
    platforms: stringList,
    note: nullableString,
  },
  books: {
    ...common,
    ...tracking,
    openLibraryId: nullableString,
    isbn: nullableString,
    title,
    authors: stringList,
    publisher: nullableString,
    pageCount: nullableInteger,
    releaseDate: nullableDate,
    overview: nullableString,
    genres: stringList,
    note: nullableString,
  },
};
