import type { Book } from '@metrack/domain';
import type { EntityRepository } from './EntityRepository.js';

export interface BookRepository extends EntityRepository<Book> {
  findByOpenLibraryId(openLibraryId: string): Promise<Book | undefined>;
  findByIsbn(isbn: string): Promise<Book | undefined>;
}
