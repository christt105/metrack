import { parseFillerList, type FillerEntry } from '@metrack/domain';
import type { FetchFn } from '../http/FetchFn.js';
import { HttpError } from '../http/HttpError.js';
import { readCappedBody } from '../http/readCappedBody.js';

const BASE_URL = 'https://www.animefillerlist.com';
const HOSTS = new Set(['www.animefillerlist.com', 'animefillerlist.com']);
const USER_AGENT = 'metrack (+https://github.com/christt105/metrack)';
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;

/** The public address of a show's page on AnimeFillerList. */
export function fillerListUrl(slug: string): string {
  return `${BASE_URL}/shows/${slug}`;
}

/**
 * Reads the episode list of a show from AnimeFillerList, which has no API: the page is fetched and parsed. One
 * request per call, only to that site, with a timeout and a size limit.
 */
export class FillerListClient {
  constructor(private readonly fetchFn: FetchFn) {}

  /** The list of the show, or an empty one when the site has no such show. */
  async list(slug: string): Promise<FillerEntry[]> {
    const url = fillerListUrl(slug);
    const response = await this.fetchFn(url, {
      headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404) {
      await response.body?.cancel();
      return [];
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(
        `Request failed (${response.status}) for ${BASE_URL}/shows`,
        response.status,
      );
    }
    if (response.url && !HOSTS.has(new URL(response.url).hostname)) {
      await response.body?.cancel();
      throw new HttpError('AnimeFillerList redirected to another site', 502);
    }
    const bytes = await readCappedBody(response, `${BASE_URL}/shows`, MAX_BYTES);
    return parseFillerList(new TextDecoder().decode(bytes));
  }
}
