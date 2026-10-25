import type { EntityRef, SearchResult } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { ImageStore } from '../images/ImageStore.js';
import { emptySeason, emptySeries } from '../media/emptyEntities.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import { clean, emptyToNull, imageUrl } from '../providers/tmdb/mapTitle.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';
import { parseNumericId } from './parseExternalId.js';
import type { TitleProvider } from './TitleProvider.js';
import { TMDB_POSTER_PREVIEW, yearFrom } from './tmdbPreview.js';

export class TmdbSeriesProvider implements TitleProvider {
  readonly type = 'series';
  readonly provider = 'tmdb';

  constructor(
    private readonly client: TmdbClient,
    private readonly series: SeriesRepository,
    private readonly seasons: SeasonRepository,
    private readonly cache: MetadataCache,
    private readonly images: ImageStore,
  ) {}

  async search(query: string, year: number | null): Promise<SearchResult[]> {
    const response = await this.client.search('tv', query, year);
    return (response.results ?? []).map((r) => ({
      type: 'series',
      provider: this.provider,
      externalId: String(r.id),
      title: r.name ?? '',
      originalTitle: emptyToNull(r.original_name),
      year: yearFrom(r.first_air_date),
      overview: clean(r.overview),
      posterUrl: r.poster_path ? `${TMDB_POSTER_PREVIEW}${r.poster_path}` : null,
      existingId: this.series.findByTmdbId(r.id)?.id ?? null,
    }));
  }

  /** Creates the series and one planned season per TMDB season (specials are skipped). */
  async add(externalId: string): Promise<EntityRef> {
    const tmdbId = parseNumericId(externalId);
    const existing = this.series.findByTmdbId(tmdbId);
    if (existing) {
      throw ApiError.conflict('already_added', 'That series is already in the tracker', {
        existingId: existing.id,
      });
    }
    const details = await this.client.tv(tmdbId);
    const series = this.series.create({
      ...emptySeries(),
      tmdbId,
      title: details.name ?? `TMDB ${tmdbId}`,
    });
    for (const season of details.seasons ?? []) {
      if (season.season_number < 1) continue;
      this.seasons.create({
        ...emptySeason(),
        seriesId: series.id,
        number: season.season_number,
        tmdbSeasonNumber: season.season_number,
        title: emptyToNull(season.name),
        overview: clean(season.overview),
        firstAirDate: emptyToNull(season.air_date ?? undefined),
        episodeCount: season.episode_count ?? null,
        cover: await this.download(imageUrl(season.poster_path)),
      });
    }
    await this.cache.refresh('series', series.id, true);
    return { type: 'series', id: series.id };
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
