import type { Book } from '@metrack/domain';
import { buildPage } from './buildPage.js';
import { dateField } from './dateField.js';
import type { Page } from './Page.js';
import type { PageContext } from './PageContext.js';
import { trackingFields } from './trackingFields.js';

export function buildBookPage(book: Book, context: PageContext): Page {
  return buildPage(
    {
      section: 'books',
      slug: context.slugs.books.get(book.id)!,
      fields: {
        title: book.title,
        type: 'book',
        openlibrary_id: book.openLibraryId,
        isbn: book.isbn,
        author: book.authors,
        publisher: book.publisher,
        page_count: book.pageCount,
        release_date: dateField(book.releaseDate),
        overview: book.overview,
        genres: book.genres,
        tags: book.tags,
        ...trackingFields(book),
      },
      review: book.review,
      artwork: { cover: book.cover, banner: null },
    },
    context,
  );
}
