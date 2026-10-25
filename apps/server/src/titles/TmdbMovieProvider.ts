import type { EntityRef, SearchResult } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { emptyMovie } from '../media/emptyEntities.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import { clean, emptyToNull } from '../providers/tmdb/mapTitle.js';
import type { MovieRepository } from '../storage/repositories/MovieRepository.js';
import { parseNumericId } from './parseExternalId.js';
import type { TitleProvider } from './TitleProvider.js';
import { TMDB_POSTER_PREVIEW, yearFrom } from './tmdbPreview.js';

export class TmdbMovieProvider implements TitleProvider {
  readonly type = 'movie';
  readonly provider = 'tmdb';

  constructor(
    private readonly client: TmdbClient,
    private readonly movies: MovieRepository,
    private readonly cache: MetadataCache,
  ) {}

  async search(query: string, year: number | null): Promise<SearchResult[]> {
    const response = await this.client.search('movie', query, year);
    return (response.results ?? []).map((r) => ({
      type: 'movie',
      provider: this.provider,
      externalId: String(r.id),
      title: r.title ?? '',
      originalTitle: emptyToNull(r.original_title),
      year: yearFrom(r.release_date),
      overview: clean(r.overview),
      posterUrl: r.poster_path ? `${TMDB_POSTER_PREVIEW}${r.poster_path}` : null,
      existingId: this.movies.findByTmdbId(r.id)?.id ?? null,
    }));
  }

  async add(externalId: string): Promise<EntityRef> {
    const tmdbId = parseNumericId(externalId);
    const existing = this.movies.findByTmdbId(tmdbId);
    if (existing) {
      throw ApiError.conflict('already_added', 'That movie is already in the tracker', {
        existingId: existing.id,
      });
    }
    const details = await this.client.movie(tmdbId);
    const movie = this.movies.create({
      ...emptyMovie(),
      tmdbId,
      title: details.title ?? `TMDB ${tmdbId}`,
    });
    await this.cache.refresh('movie', movie.id, true);
    return { type: 'movie', id: movie.id };
  }
}
