import type { Book } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { bookTable } from '../mapping/bookTable.js';
import type { BookRepository } from '../repositories/BookRepository.js';
import type { D1Database } from './D1Database.js';
import { D1TableRepository } from './D1TableRepository.js';

export class D1BookRepository extends D1TableRepository<Book> implements BookRepository {
  constructor(db: D1Database, scope: UserScope) {
    super(db, scope, bookTable);
  }

  async findByOpenLibraryId(openLibraryId: string): Promise<Book | undefined> {
    return this.findOneBy('openlibrary_id', openLibraryId);
  }

  async findByIsbn(isbn: string): Promise<Book | undefined> {
    return this.findOneBy('isbn', isbn);
  }
}
