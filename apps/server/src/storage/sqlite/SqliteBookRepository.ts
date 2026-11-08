import type { DatabaseSync } from 'node:sqlite';
import type { Book } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { bookTable } from '../mapping/bookTable.js';
import type { BookRepository } from '../repositories/BookRepository.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';

export class SqliteBookRepository extends SqliteTableRepository<Book> implements BookRepository {
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, bookTable);
  }

  async findByOpenLibraryId(openLibraryId: string): Promise<Book | undefined> {
    return this.findOneBy('openlibrary_id', openLibraryId);
  }

  async findByIsbn(isbn: string): Promise<Book | undefined> {
    return this.findOneBy('isbn', isbn);
  }
}
