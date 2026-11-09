import type { Movie } from '@metrack/domain';
import type { MediaTableSpec } from './MediaTableSpec.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

const ENTRY_COLUMNS = [
  'jellyfin_id',
  'follow',
  'note',
  'slug',
  'tags',
  'status',
  'started_at',
  'finished_at',
  'rating',
  'review',
  'rewatches',
  'pending_review',
];

function movieToRow(m: Omit<Movie, 'id'>): RowValues {
  return {
    tmdb_id: m.tmdbId,
    jellyfin_id: m.jellyfinId,
    title: m.title,
    original_title: m.originalTitle,
    release_date: m.releaseDate,
    overview: m.overview,
    genres: JSON.stringify(m.genres),
    cast_members: JSON.stringify(m.cast),
    director: m.director,
    follow: m.follow ? 1 : 0,
    note: m.note,
    cover: m.cover,
    banner: m.banner,
    slug: m.slug,
    tags: JSON.stringify(m.tags),
    ...trackingToRow(m),
  };
}

function movieFromRow(row: Row): Movie {
  return {
    id: Number(row.id),
    tmdbId: num(row.tmdb_id),
    jellyfinId: text(row.jellyfin_id),
    title: String(row.title),
    originalTitle: text(row.original_title),
    releaseDate: text(row.release_date),
    overview: text(row.overview),
    genres: parseList(row.genres),
    cast: parseList(row.cast_members),
    director: text(row.director),
    follow: Number(row.follow) === 1,
    note: text(row.note),
    cover: text(row.cover),
    banner: text(row.banner),
    slug: text(row.slug),
    tags: parseList(row.tags),
    ...trackingFromRow(row),
  };
}

export const movieTable: MediaTableSpec<Movie> = {
  table: 'movie',
  entryColumns: ENTRY_COLUMNS,
  catalogKeys: [['tmdb_id']],
  relatedDeletes: [],
  ownable: true,
  toRow: movieToRow,
  fromRow: movieFromRow,
};
