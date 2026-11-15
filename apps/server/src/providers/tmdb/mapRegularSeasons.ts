import type { ProviderSeason } from '@metrack/domain';
import { clean, emptyToNull, imageUrl } from './mapTitle.js';
import type { TmdbSeasonSummary } from './TmdbSeasonSummary.js';

/** The regular TMDB seasons of a series; season 0 holds the specials and is left out. */
export function mapRegularSeasons(
  seasons: readonly TmdbSeasonSummary[] | undefined,
): ProviderSeason[] {
  return (seasons ?? [])
    .filter((season) => season.season_number >= 1)
    .map((season) => ({
      number: season.season_number,
      title: emptyToNull(season.name),
      overview: clean(season.overview),
      firstAirDate: emptyToNull(season.air_date ?? undefined),
      episodeCount: season.episode_count ?? null,
      posterUrl: imageUrl(season.poster_path),
    }));
}
