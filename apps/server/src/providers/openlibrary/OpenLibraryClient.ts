import type { FetchFn } from '../../http/FetchFn.js';
import { HttpError } from '../../http/HttpError.js';
import type { OpenLibraryWork } from './OpenLibraryWork.js';
import type { OpenLibraryWorkRecord } from './OpenLibraryWorkRecord.js';

const BASE_URL = 'https://openlibrary.org';
const USER_AGENT = 'metrack (+https://github.com/christt105/metrack)';
const SEARCH_FIELDS = [
  'key',
  'title',
  'author_name',
  'first_publish_year',
  'cover_i',
  'number_of_pages_median',
  'subject',
  'editions',
  'editions.key',
  'editions.title',
  'editions.subtitle',
  'editions.cover_i',
  'editions.language',
  'editions.publisher',
  'editions.isbn',
].join(',');

/**
 * Open Library catalogue. It needs no key. Every work found comes with the edition that best matches
 * `language` (an ISO 639-1 code such as `es`), which carries the translated title and cover.
 */
export class OpenLibraryClient {
  constructor(
    private readonly fetchFn: FetchFn,
    private readonly language: string,
  ) {}

  /** Works matching `query`, optionally first published in `year`. */
  search(query: string, year: number | null): Promise<OpenLibraryWork[]> {
    return this.find(year === null ? query : `${query} first_publish_year:${year}`, 20);
  }

  /** The work with id `workId` (such as `OL8479867W`), or null when there is none. */
  async work(workId: string): Promise<OpenLibraryWork | null> {
    const [work] = await this.find(`key:/works/${workId}`, 1);
    return work ?? null;
  }

  /** The parts of the work record the search does not return, such as the description. */
  workRecord(workId: string): Promise<OpenLibraryWorkRecord> {
    return this.get<OpenLibraryWorkRecord>(new URL(`/works/${workId}.json`, BASE_URL));
  }

  private async find(q: string, limit: number): Promise<OpenLibraryWork[]> {
    const url = new URL('/search.json', BASE_URL);
    url.searchParams.set('q', q);
    url.searchParams.set('lang', this.language);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('fields', SEARCH_FIELDS);
    return (await this.get<{ docs?: OpenLibraryWork[] }>(url)).docs ?? [];
  }

  private async get<T>(url: URL): Promise<T> {
    const response = await this.fetchFn(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      throw new HttpError(
        `Request failed (${response.status}) for ${url.pathname}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }
}
