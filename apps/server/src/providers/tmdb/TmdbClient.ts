import type { FetchFn } from '../../http/FetchFn.js';
import { getJson, type QueryParams } from '../../http/getJson.js';
import { getJsonCapped } from '../../http/getJsonCapped.js';
import type { TmdbReleaseResponse } from './TmdbReleaseResponse.js';
import type { TmdbImagesResponse } from './TmdbImagesResponse.js';
import type { TmdbSearchResponse } from './TmdbSearchResponse.js';
import type { TmdbClientOptions } from './TmdbClientOptions.js';
import type { TmdbEpisodeGroup } from './TmdbEpisodeGroup.js';
import type { TmdbEpisodeGroupList } from './TmdbEpisodeGroupList.js';
import type { TmdbEpisodeMatch } from './TmdbEpisodeMatch.js';
import type { TmdbFindResponse } from './TmdbFindResponse.js';
import type { TmdbSeasonEpisode } from './TmdbSeasonEpisode.js';
import type { TmdbSeasonResponse } from './TmdbSeasonResponse.js';
import type { TmdbTitleResponse } from './TmdbTitleResponse.js';

const BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
export const TMDB_IMAGE_HOST = 'image.tmdb.org';
/** The largest season document read; the median is 60 KB and a few with crew and guest stars pass 1 MB. */
export const TMDB_SEASON_MAX_BYTES = 1_000_000;
const MAX_APPENDED_SEASONS = 20;

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

  /** The TMDB episode TheTVDB knows by `tvdbId`, or null when TMDB has no match. */
  async episodeForTvdb(tvdbId: number): Promise<TmdbEpisodeMatch | null> {
    const found = await this.get<TmdbFindResponse>(`/find/${tvdbId}`, {
      external_source: 'tvdb_id',
    });
    const episode = found.tv_episode_results?.[0];
    return episode ? { id: episode.id, showId: episode.show_id ?? null } : null;
  }

  /**
   * Several regular seasons of a series with their episodes in one request (TMDB appends up to 20 sub-requests to
   * a title); the documents are not capped, so this is for callers that have no CPU limit. A season TMDB does not
   * return is absent from the result.
   */
  async seasonsOf(
    tvId: number,
    seasonNumbers: readonly number[],
  ): Promise<Map<number, TmdbSeasonResponse>> {
    const seasons = new Map<number, TmdbSeasonResponse>();
    for (let from = 0; from < seasonNumbers.length; from += MAX_APPENDED_SEASONS) {
      const numbers = seasonNumbers.slice(from, from + MAX_APPENDED_SEASONS);
      const response = await this.get<Record<string, unknown>>(`/tv/${tvId}`, {
        language: this.options.language,
        append_to_response: numbers.map((n) => `season/${n}`).join(','),
      });
      for (const number of numbers) {
        const season = response[`season/${number}`];
        if (typeof season === 'object' && season !== null) {
          seasons.set(number, season as TmdbSeasonResponse);
        }
      }
    }
    return seasons;
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
