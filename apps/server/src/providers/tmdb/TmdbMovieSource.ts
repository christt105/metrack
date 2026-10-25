import type { Movie } from '@metrack/domain';
import type { MetadataSource } from '../../metadata/MetadataSource.js';
import type { ProviderMetadata } from '../../metadata/ProviderMetadata.js';
import { clean, emptyToNull, imageUrl, mapCast, mapGenres } from './mapTitle.js';
import type { TmdbClient } from './TmdbClient.js';

export class TmdbMovieSource implements MetadataSource<Movie> {
  constructor(private readonly client: TmdbClient) {}

  async fetch(movie: Movie): Promise<ProviderMetadata<Movie>> {
    if (movie.tmdbId === null) throw new Error(`Movie ${movie.id} has no TMDB id`);
    const r = await this.client.movie(movie.tmdbId);
    return {
      fields: {
        title: r.title ?? movie.title,
        originalTitle: emptyToNull(r.original_title),
        releaseDate: emptyToNull(r.release_date),
        overview: clean(r.overview),
        genres: mapGenres(r),
        cast: mapCast(r),
        director: r.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null,
      },
      coverUrl: imageUrl(r.poster_path),
      bannerUrl: imageUrl(r.backdrop_path),
    };
  }
}
