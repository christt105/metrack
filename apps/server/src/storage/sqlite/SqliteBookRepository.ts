import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { Book } from '@metrack/domain';
import type { BookRepository } from '../repositories/BookRepository.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';
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

export class SqliteBookRepository extends SqliteTableRepository<Book> implements BookRepository {
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, 'book', ENTRY_COLUMNS, [['openlibrary_id']]);
  }

  async findByOpenLibraryId(openLibraryId: string): Promise<Book | undefined> {
    return this.findOneBy('openlibrary_id', openLibraryId);
  }

  async findByIsbn(isbn: string): Promise<Book | undefined> {
    return this.findOneBy('isbn', isbn);
  }

  protected toRow(b: Omit<Book, 'id'>): RowValues {
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

  protected fromRow(row: Row): Book {
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
}
