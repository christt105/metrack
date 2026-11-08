import type { Book } from '@metrack/domain';
import type { MediaTableSpec } from './MediaTableSpec.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

const ENTRY_COLUMNS = [
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

function bookToRow(b: Omit<Book, 'id'>): RowValues {
  return {
    openlibrary_id: b.openLibraryId,
    isbn: b.isbn,
    title: b.title,
    authors: JSON.stringify(b.authors),
    publisher: b.publisher,
    page_count: b.pageCount,
    release_date: b.releaseDate,
    overview: b.overview,
    genres: JSON.stringify(b.genres),
    note: b.note,
    cover: b.cover,
    slug: b.slug,
    tags: JSON.stringify(b.tags),
    ...trackingToRow(b),
  };
}

function bookFromRow(row: Row): Book {
  return {
    id: Number(row.id),
    openLibraryId: text(row.openlibrary_id),
    isbn: text(row.isbn),
    title: String(row.title),
    authors: parseList(row.authors),
    publisher: text(row.publisher),
    pageCount: num(row.page_count),
    releaseDate: text(row.release_date),
    overview: text(row.overview),
    genres: parseList(row.genres),
    note: text(row.note),
    cover: text(row.cover),
    slug: text(row.slug),
    tags: parseList(row.tags),
    ...trackingFromRow(row),
  };
}

export const bookTable: MediaTableSpec<Book> = {
  table: 'book',
  entryColumns: ENTRY_COLUMNS,
  catalogKeys: [['openlibrary_id']],
  relatedDeletes: [],
  ownable: true,
  toRow: bookToRow,
  fromRow: bookFromRow,
};
