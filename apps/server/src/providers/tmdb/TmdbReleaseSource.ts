import type { MovieRelease } from '../../alerts/MovieRelease.js';
import type { ReleaseSource } from '../../alerts/ReleaseSource.js';
import type { SeriesRelease } from '../../alerts/SeriesRelease.js';
import { hasFlatrateInSpain, movieReleaseDate } from './mapRelease.js';
import { emptyToNull } from './mapTitle.js';
import type { TmdbClient } from './TmdbClient.js';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

function posterUrl(path: string | null | undefined): string | null {
  return path ? `${POSTER_BASE}${path}` : null;
}

/** Reads release dates and Spanish providers from TMDB. */
export class TmdbReleaseSource implements ReleaseSource {
  constructor(private readonly client: TmdbClient) {}

  async series(tmdbId: number): Promise<SeriesRelease> {
    const response = await this.client.tvReleases(tmdbId);
    const next = response.next_episode_to_air;
    return {
      posterUrl: posterUrl(response.poster_path),
      numberOfSeasons: response.number_of_seasons ?? 0,
      seasons: (response.seasons ?? []).map((s) => ({
        number: s.season_number,
        name: emptyToNull(s.name),
        overview: emptyToNull(s.overview),
        airDate: emptyToNull(s.air_date ?? undefined),
        episodeCount: s.episode_count ?? null,
      })),
      nextEpisode: next?.air_date
        ? {
            seasonNumber: next.season_number,
            episodeNumber: next.episode_number,
            airDate: next.air_date,
          }
        : null,
      flatrateEs: hasFlatrateInSpain(response),
    };
  }

  async movie(tmdbId: number): Promise<MovieRelease> {
    const response = await this.client.movieReleases(tmdbId);
    return {
      posterUrl: posterUrl(response.poster_path),
      releaseDate: movieReleaseDate(response),
      flatrateEs: hasFlatrateInSpain(response),
    };
  }
}
