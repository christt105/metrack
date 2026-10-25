import type { DatabaseSync } from 'node:sqlite';
import type { Book } from '@metrack/domain';
import { TableRepository, type Row, type RowValues } from './TableRepository.js';
import { num, parseList, text, trackingFromRow, trackingToRow } from './rowMapping.js';

export class BookRepository extends TableRepository<Book> {
  constructor(db: DatabaseSync) {
    super(db, 'book');
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
      ...trackingFromRow(row),
    };
  }
}
