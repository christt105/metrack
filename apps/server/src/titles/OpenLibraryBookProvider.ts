import type { EntityRef, SearchResult } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { ImageStore } from '../images/ImageStore.js';
import { emptyBook } from '../media/emptyEntities.js';
import type { OpenLibraryClient } from '../providers/openlibrary/OpenLibraryClient.js';
import type { OpenLibraryEdition } from '../providers/openlibrary/OpenLibraryEdition.js';
import type { OpenLibraryWork } from '../providers/openlibrary/OpenLibraryWork.js';
import type { OpenLibraryWorkRecord } from '../providers/openlibrary/OpenLibraryWorkRecord.js';
import { openLibraryCoverUrl } from '../providers/openlibrary/openLibraryCoverUrl.js';
import type { BookRepository } from '../storage/repositories/BookRepository.js';
import type { TitleProvider } from './TitleProvider.js';

const WORK_ID = /^OL\d+W$/;
const MAX_GENRES = 5;

function workId(work: OpenLibraryWork): string {
  return work.key.replace(/^\/works\//, '');
}

function editionOf(work: OpenLibraryWork): OpenLibraryEdition | undefined {
  return work.editions?.docs?.[0];
}

function textOf(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

function titleOf(work: OpenLibraryWork): string {
  const edition = editionOf(work);
  const title = textOf(edition?.title);
  const subtitle = textOf(edition?.subtitle);
  if (title) return subtitle ? `${title}: ${subtitle}` : title;
  return textOf(work.title) ?? workId(work);
}

function isbnOf(edition: OpenLibraryEdition | undefined): string | null {
  const isbns = edition?.isbn ?? [];
  return isbns.find((isbn) => isbn.length === 13) ?? isbns[0] ?? null;
}

/** `YYYY-MM-DD` for a publish date that names the day (`2007-03-27`, `March 27, 2007`), else null. */
function exactDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const namesDay = raw.includes('-') ? /^\d{4}-\d{2}-\d{2}$/.test(raw) : /\b\d{1,2}\b/.test(raw);
  const date = new Date(`${raw} UTC`);
  return namesDay && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/** The first publish date, or the first of January of the first publish year when only that is known. */
function releaseDateOf(work: OpenLibraryWork, record: OpenLibraryWorkRecord): string | null {
  const exact = exactDate(record.first_publish_date);
  if (exact) return exact;
  return work.first_publish_year ? `${work.first_publish_year}-01-01` : null;
}

function overviewOf(record: OpenLibraryWorkRecord): string | null {
  const raw =
    typeof record.description === 'string' ? record.description : record.description?.value;
  const text = raw
    ?.replace(/\(\[source\]\[\d+\]\)/gi, '')
    .replace(/-{3,}[\s\S]*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text : null;
}

function genresOf(work: OpenLibraryWork): string[] {
  return (work.subject ?? [])
    .filter((subject) => subject.length <= 30 && /^[\p{L}\s&'-]+$/u.test(subject))
    .slice(0, MAX_GENRES);
}

/**
 * Books from Open Library, identified by their work id. The title, cover, publisher and ISBN come from
 * the edition in the configured language when there is one, the rest from the work. Adding a book
 * stores its metadata once (books have no metadata refresh) and its cover.
 */
export class OpenLibraryBookProvider implements TitleProvider {
  readonly type = 'book';
  readonly provider = 'openlibrary';

  constructor(
    private readonly client: OpenLibraryClient,
    private readonly books: BookRepository,
    private readonly images: ImageStore,
  ) {}

  async search(query: string, year: number | null): Promise<SearchResult[]> {
    const found = await this.client.search(query, year);
    return found.map((work) => {
      const title = titleOf(work);
      const authors = work.author_name ?? [];
      return {
        type: 'book',
        provider: this.provider,
        externalId: workId(work),
        title,
        originalTitle: textOf(work.title) !== title ? textOf(work.title) : null,
        year: work.first_publish_year ?? null,
        overview: authors.length > 0 ? authors.join(', ') : null,
        posterUrl: openLibraryCoverUrl(editionOf(work)?.cover_i ?? work.cover_i, 'M'),
        existingId: this.books.findByOpenLibraryId(workId(work))?.id ?? null,
      };
    });
  }

  async add(externalId: string): Promise<EntityRef> {
    if (!WORK_ID.test(externalId)) {
      throw ApiError.badRequest('invalid_external_id', `Not a valid id: ${externalId}`);
    }
    const existing = this.books.findByOpenLibraryId(externalId);
    if (existing) {
      throw ApiError.conflict('already_added', 'That book is already in the tracker', {
        existingId: existing.id,
      });
    }
    const work = await this.client.work(externalId);
    if (!work) throw ApiError.notFound('Open Library has no work with that id');
    const record = await this.client.workRecord(externalId).catch(() => ({}));
    const edition = editionOf(work);

    const cover =
      (await this.download(openLibraryCoverUrl(edition?.cover_i, 'L'))) ??
      (await this.download(openLibraryCoverUrl(work.cover_i, 'L')));

    const created = this.books.create({
      ...emptyBook(),
      openLibraryId: externalId,
      isbn: isbnOf(edition),
      title: titleOf(work),
      authors: work.author_name ?? [],
      publisher: textOf(edition?.publisher?.[0]),
      pageCount: work.number_of_pages_median ?? null,
      releaseDate: releaseDateOf(work, record),
      overview: overviewOf(record),
      genres: genresOf(work),
      cover,
    });
    return { type: 'book', id: created.id };
  }

  private async download(url: string | null): Promise<string | null> {
    if (!url) return null;
    try {
      return (await this.images.download(url)).ref;
    } catch {
      return null;
    }
  }
}
