import type { Book } from '@metrack/domain';
import { readInteger, readList, readText } from './fieldReaders.js';
import { parseImageSource } from './parseImageSource.js';
import { readDescriptiveDate } from './readDescriptiveDate.js';
import { readInlineImages } from './readInlineImages.js';
import { readTitle } from './readTitle.js';
import { readTracking } from './readTracking.js';
import type { IssueLog } from './IssueLog.js';
import type { PlannedEntity } from './PlannedEntity.js';
import type { VaultNote } from './VaultNote.js';

export function planBook(
  note: VaultNote,
  vaultDir: string,
  issues: IssueLog,
): PlannedEntity<Omit<Book, 'id'>> {
  const fm = note.frontmatter;
  const authors = readList(fm.authors);
  const pages = readInteger(fm.page_count);
  if (pages.invalid) issues.add('invalid-id', note.path, `page_count: ${String(fm.page_count)}`);
  const entity: Omit<Book, 'id'> = {
    openLibraryId: readText(fm.openlibrary_id),
    isbn: readText(fm.isbn),
    title: readTitle(note, issues),
    authors: authors.length > 0 ? authors : readList(fm.author),
    publisher: readText(fm.publisher),
    pageCount: pages.value,
    releaseDate: readDescriptiveDate(note, 'release_date', issues),
    overview: readText(fm.overview),
    genres: readList(fm.genres),
    note: null,
    cover: null,
    slug: note.name,
    tags: readList(fm.tags),
    ...readTracking(note, issues),
  };
  return {
    path: note.path,
    entity,
    cover: parseImageSource(fm.cover, 'cover', vaultDir, note.path, issues),
    banner: null,
    inline: readInlineImages(note, vaultDir, issues),
  };
}
