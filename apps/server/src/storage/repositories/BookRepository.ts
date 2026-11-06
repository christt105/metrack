import type { Book } from '@metrack/domain';
import type { MediaEntityRepository } from './MediaEntityRepository.js';

export interface BookRepository extends MediaEntityRepository<Book> {
  findByOpenLibraryId(openLibraryId: string): Promise<Book | undefined>;
  findByIsbn(isbn: string): Promise<Book | undefined>;
}
