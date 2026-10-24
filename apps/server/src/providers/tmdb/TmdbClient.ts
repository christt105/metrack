import type { FetchFn } from '../../http/FetchFn.js';
import { getJson, type QueryParams } from '../../http/getJson.js';
import type { TmdbClientOptions } from './TmdbClientOptions.js';
import type { TmdbTitleResponse } from './TmdbTitleResponse.js';

const BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

export class TmdbClient {
  constructor(
    private readonly fetchFn: FetchFn,
    private readonly options: TmdbClientOptions,
  ) {}

  movie(id: number): Promise<TmdbTitleResponse> {
    return this.details('movie', id);
  }

  tv(id: number): Promise<TmdbTitleResponse> {
    return this.details('tv', id);
  }

  private details(path: 'movie' | 'tv', id: number): Promise<TmdbTitleResponse> {
    return this.get(`/${path}/${id}`, {
      language: this.options.language,
      append_to_response: 'credits',
    });
  }

  private get<T>(path: string, params: QueryParams): Promise<T> {
    const key = this.options.apiKey.replace(/^Bearer\s+/i, '');
    if (key.length > 40) {
      return getJson<T>(this.fetchFn, `${BASE}${path}`, params, { Authorization: `Bearer ${key}` });
    }
    return getJson<T>(this.fetchFn, `${BASE}${path}`, { ...params, api_key: key });
  }
}
