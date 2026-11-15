import type { MovieRelease } from '../../alerts/MovieRelease.js';
import type { ReleaseSource } from '../../alerts/ReleaseSource.js';
import type { SeriesRelease } from '../../alerts/SeriesRelease.js';
import { hasFlatrateInSpain, movieReleaseDate } from './mapRelease.js';
import { groupEpisodePosition } from './groupEpisodePosition.js';
import { mapGroupSeasons } from './mapGroupSeasons.js';
import { emptyToNull } from './mapTitle.js';
import type { TmdbClient } from './TmdbClient.js';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

function posterUrl(path: string | null | undefined): string | null {
  return path ? `${POSTER_BASE}${path}` : null;
}

/** Reads release dates and Spanish providers from TMDB. */
export class TmdbReleaseSource implements ReleaseSource {
  constructor(private readonly client: TmdbClient) {}

  /**
   * With an episode group the seasons and the next episode are those of that ordering. A next episode the
   * group does not hold yet starts the season after the group's last one.
   */
  async series(tmdbId: number, episodeGroup: string | null = null): Promise<SeriesRelease> {
    const response = await this.client.tvReleases(tmdbId);
    const next = response.next_episode_to_air;
    const nextEpisode = next?.air_date
      ? {
          seasonNumber: next.season_number,
          episodeNumber: next.episode_number,
          airDate: next.air_date,
        }
      : null;
    const release: SeriesRelease = {
      posterUrl: posterUrl(response.poster_path),
      numberOfSeasons: response.number_of_seasons ?? 0,
      seasons: (response.seasons ?? []).map((s) => ({
        number: s.season_number,
        name: emptyToNull(s.name),
        overview: emptyToNull(s.overview),
        airDate: emptyToNull(s.air_date ?? undefined),
        episodeCount: s.episode_count ?? null,
      })),
      nextEpisode,
      flatrateEs: hasFlatrateInSpain(response),
    };
    if (episodeGroup === null) return release;

    const group = await this.client.episodeGroup(episodeGroup);
    const seasons = mapGroupSeasons(group).map((s) => ({
      number: s.number,
      name: s.title,
      overview: s.overview,
      airDate: s.firstAirDate,
      episodeCount: s.episodeCount,
    }));
    let grouped = null;
    if (nextEpisode !== null && nextEpisode.seasonNumber >= 1) {
      const position = groupEpisodePosition(
        group,
        nextEpisode.seasonNumber,
        nextEpisode.episodeNumber,
      );
      if (position) {
        grouped = { ...position, airDate: nextEpisode.airDate };
      } else {
        const guessed = Math.max(0, ...seasons.map((s) => s.number)) + 1;
        seasons.push({
          number: guessed,
          name: null,
          overview: null,
          airDate: nextEpisode.airDate,
          episodeCount: null,
        });
        grouped = { seasonNumber: guessed, episodeNumber: 1, airDate: nextEpisode.airDate };
      }
    }
    return {
      ...release,
      numberOfSeasons: Math.max(0, ...seasons.map((s) => s.number)),
      seasons,
      nextEpisode: grouped,
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
