import type { Series } from '@metrack/domain';
import type { MetadataSource } from '../../metadata/MetadataSource.js';
import type { ProviderMetadata } from '../../metadata/ProviderMetadata.js';
import { clean, emptyToNull, imageUrl, mapCast, mapGenres } from './mapTitle.js';
import type { TmdbClient } from './TmdbClient.js';

export class TmdbSeriesSource implements MetadataSource<Series> {
  constructor(private readonly client: TmdbClient) {}

  async fetch(series: Series): Promise<ProviderMetadata<Series>> {
    if (series.tmdbId === null) throw new Error(`Series ${series.id} has no TMDB id`);
    const r = await this.client.tv(series.tmdbId);
    return {
      fields: {
        title: r.name ?? series.title,
        originalTitle: emptyToNull(r.original_name),
        firstAirDate: emptyToNull(r.first_air_date),
        overview: clean(r.overview),
        genres: mapGenres(r),
        cast: mapCast(r),
      },
      coverUrl: imageUrl(r.poster_path),
      bannerUrl: imageUrl(r.backdrop_path),
    };
  }
}
