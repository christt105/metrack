import type { FetchFn } from '../../http/FetchFn.js';
import { getJson, type QueryParams } from '../../http/getJson.js';
import { getJsonCapped } from '../../http/getJsonCapped.js';
import type { TmdbReleaseResponse } from './TmdbReleaseResponse.js';
import type { TmdbImagesResponse } from './TmdbImagesResponse.js';
import type { TmdbSearchResponse } from './TmdbSearchResponse.js';
import type { TmdbClientOptions } from './TmdbClientOptions.js';
import type { TmdbEpisodeGroup } from './TmdbEpisodeGroup.js';
import type { TmdbEpisodeGroupList } from './TmdbEpisodeGroupList.js';
import type { TmdbFindResponse } from './TmdbFindResponse.js';
import type { TmdbSeasonEpisode } from './TmdbSeasonEpisode.js';
import type { TmdbSeasonResponse } from './TmdbSeasonResponse.js';
import type { TmdbTitleResponse } from './TmdbTitleResponse.js';

const BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
export const TMDB_IMAGE_HOST = 'image.tmdb.org';
/** The largest season document read; the median is 60 KB and a few with crew and guest stars pass 1 MB. */
export const TMDB_SEASON_MAX_BYTES = 1_000_000;

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

  /** A series with its seasons, next episode and watch providers. */
  tvReleases(id: number): Promise<TmdbReleaseResponse> {
    return this.get(`/tv/${id}`, {
      language: this.options.language,
      append_to_response: 'watch/providers',
    });
  }

  /** A movie with its per-country release dates and watch providers. */
  movieReleases(id: number): Promise<TmdbReleaseResponse> {
    return this.get(`/movie/${id}`, {
      language: this.options.language,
      append_to_response: 'release_dates,watch/providers',
    });
  }

  /** The alternative season orderings TMDB has for a series. */
  episodeGroups(tvId: number): Promise<TmdbEpisodeGroupList> {
    return this.get(`/tv/${tvId}/episode_groups`, {});
  }

  /** One episode group with its seasons and their episodes. */
  episodeGroup(groupId: string): Promise<TmdbEpisodeGroup> {
    return this.get(`/tv/episode_group/${encodeURIComponent(groupId)}`, {
      language: this.options.language,
    });
  }

  /** One regular season with its episodes. Refuses (`ResponseTooLargeError`) a document over 1 MB without parsing it. */
  season(tvId: number, seasonNumber: number): Promise<TmdbSeasonResponse> {
    return this.getCapped(`/tv/${tvId}/season/${seasonNumber}`, TMDB_SEASON_MAX_BYTES, {
      language: this.options.language,
    });
  }

  /** One episode of a regular season, for seasons too large to read whole. */
  seasonEpisode(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<TmdbSeasonEpisode> {
    return this.get(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`, {
      language: this.options.language,
    });
  }

  /** The TMDB id of the series TheTVDB knows by `tvdbId`, or null when TMDB has no match. */
  async seriesIdForTvdb(tvdbId: number): Promise<number | null> {
    const found = await this.get<TmdbFindResponse>(`/find/${tvdbId}`, {
      external_source: 'tvdb_id',
    });
    return found.tv_results[0]?.id ?? null;
  }

  /** Title search. `year` narrows by release year (first air year for TV). */
  async search(
    path: 'movie' | 'tv',
    query: string,
    year: number | null,
  ): Promise<TmdbSearchResponse> {
    return this.get(`/search/${path}`, {
      query,
      language: this.options.language,
      ...(year === null ? {} : path === 'movie' ? { year } : { first_air_date_year: year }),
    });
  }

  /** Every poster and backdrop TMDB has for a title, in the configured language, English and untextured. */
  images(path: 'movie' | 'tv', id: number): Promise<TmdbImagesResponse> {
    return this.get(`/${path}/${id}/images`, { include_image_language: this.imageLanguages() });
  }

  seasonImages(tvId: number, seasonNumber: number): Promise<TmdbImagesResponse> {
    return this.get(`/tv/${tvId}/season/${seasonNumber}/images`, {
      include_image_language: this.imageLanguages(),
    });
  }

  private imageLanguages(): string {
    return [...new Set([this.options.language.slice(0, 2), 'en', 'null'])].join(',');
  }

  private details(path: 'movie' | 'tv', id: number): Promise<TmdbTitleResponse> {
    return this.get(`/${path}/${id}`, {
      language: this.options.language,
      append_to_response: 'credits',
    });
  }

  private getCapped<T>(path: string, maxBytes: number, params: QueryParams): Promise<T> {
    const key = this.options.apiKey.replace(/^Bearer\s+/i, '');
    if (key.length > 40) {
      return getJsonCapped<T>(this.fetchFn, `${BASE}${path}`, maxBytes, params, {
        Authorization: `Bearer ${key}`,
      });
    }
    return getJsonCapped<T>(this.fetchFn, `${BASE}${path}`, maxBytes, { ...params, api_key: key });
  }

  private get<T>(path: string, params: QueryParams): Promise<T> {
    const key = this.options.apiKey.replace(/^Bearer\s+/i, '');
    if (key.length > 40) {
      return getJson<T>(this.fetchFn, `${BASE}${path}`, params, { Authorization: `Bearer ${key}` });
    }
    return getJson<T>(this.fetchFn, `${BASE}${path}`, { ...params, api_key: key });
  }
}
