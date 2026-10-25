import type { Collection } from '@metrack/domain';
import type { FieldSchema } from './FieldSchema';

const tracking: FieldSchema[] = [
  { key: 'startedAt', kind: 'date', section: 'tracking' },
  { key: 'finishedAt', kind: 'date', section: 'tracking' },
  { key: 'rating', kind: 'rating', section: 'tracking' },
  { key: 'review', kind: 'textarea', section: 'tracking' },
];

const housekeeping: FieldSchema[] = [
  { key: 'note', kind: 'text', section: 'notes' },
  { key: 'slug', kind: 'text', section: 'notes' },
  { key: 'tags', kind: 'list', section: 'notes' },
];

/** The editable fields of each collection, in display order. Status is handled by its own control. */
export const fieldSchemas: Record<Collection, FieldSchema[]> = {
  movies: [
    { key: 'tmdbId', kind: 'integer', section: 'ids' },
    { key: 'jellyfinId', kind: 'text', section: 'ids' },
    { key: 'title', kind: 'text', section: 'metadata', required: true },
    { key: 'originalTitle', kind: 'text', section: 'metadata' },
    { key: 'releaseDate', kind: 'date', section: 'metadata' },
    { key: 'director', kind: 'text', section: 'metadata' },
    { key: 'genres', kind: 'list', section: 'metadata' },
    { key: 'cast', kind: 'list', section: 'metadata' },
    { key: 'overview', kind: 'textarea', section: 'metadata' },
    ...tracking,
    ...housekeeping,
  ],
  series: [
    { key: 'tmdbId', kind: 'integer', section: 'ids' },
    { key: 'tvdbId', kind: 'integer', section: 'ids' },
    { key: 'jellyfinId', kind: 'text', section: 'ids' },
    { key: 'title', kind: 'text', section: 'metadata', required: true },
    { key: 'originalTitle', kind: 'text', section: 'metadata' },
    { key: 'firstAirDate', kind: 'date', section: 'metadata' },
    { key: 'genres', kind: 'list', section: 'metadata' },
    { key: 'cast', kind: 'list', section: 'metadata' },
    { key: 'overview', kind: 'textarea', section: 'metadata' },
    { key: 'review', kind: 'textarea', section: 'notes' },
    ...housekeeping,
  ],
  seasons: [
    { key: 'number', kind: 'integer', section: 'ids', required: true },
    { key: 'tmdbSeasonNumber', kind: 'integer', section: 'ids' },
    { key: 'jellyfinId', kind: 'text', section: 'ids' },
    { key: 'title', kind: 'text', section: 'metadata' },
    { key: 'firstAirDate', kind: 'date', section: 'metadata' },
    { key: 'episodeCount', kind: 'integer', section: 'metadata' },
    { key: 'overview', kind: 'textarea', section: 'metadata' },
    ...tracking,
    { key: 'slug', kind: 'text', section: 'notes' },
    { key: 'tags', kind: 'list', section: 'notes' },
  ],
  games: [
    { key: 'igdbId', kind: 'integer', section: 'ids' },
    { key: 'steamAppId', kind: 'text', section: 'ids' },
    { key: 'steamGridDbId', kind: 'integer', section: 'ids' },
    { key: 'title', kind: 'text', section: 'metadata', required: true },
    { key: 'releaseDate', kind: 'date', section: 'metadata' },
    { key: 'developer', kind: 'text', section: 'metadata' },
    { key: 'platforms', kind: 'list', section: 'metadata' },
    { key: 'genres', kind: 'list', section: 'metadata' },
    { key: 'overview', kind: 'textarea', section: 'metadata' },
    ...tracking,
    ...housekeeping,
  ],
  books: [
    { key: 'openLibraryId', kind: 'text', section: 'ids' },
    { key: 'isbn', kind: 'text', section: 'ids' },
    { key: 'title', kind: 'text', section: 'metadata', required: true },
    { key: 'authors', kind: 'list', section: 'metadata' },
    { key: 'publisher', kind: 'text', section: 'metadata' },
    { key: 'pageCount', kind: 'integer', section: 'metadata' },
    { key: 'releaseDate', kind: 'date', section: 'metadata' },
    { key: 'genres', kind: 'list', section: 'metadata' },
    { key: 'overview', kind: 'textarea', section: 'metadata' },
    ...tracking,
    ...housekeeping,
  ],
};

/** Collections whose entities carry status, dates, rating and rewatches of their own. */
export function isTracked(collection: Collection): boolean {
  return collection !== 'series';
}

/** Which kinds of image an entity of this collection can have. */
export function imageKindsOf(collection: Collection): ('cover' | 'banner')[] {
  if (collection === 'books') return ['cover'];
  if (collection === 'seasons') return ['cover'];
  return ['cover', 'banner'];
}
