import type { ProviderSeason } from '@metrack/domain';
import { emptyToNull } from './mapTitle.js';
import type { TmdbEpisodeGroup } from './TmdbEpisodeGroup.js';

const GENERIC_NAME = /^(season|temporada)\s*\d+$/i;

/**
 * The seasons of an episode group, numbered by `order`; order 0 holds the specials and is left out. Group names
 * are not translated, so a generic one such as "Season 2" is dropped and the season keeps its own title.
 */
export function mapGroupSeasons(group: TmdbEpisodeGroup): ProviderSeason[] {
  return (group.groups ?? [])
    .filter((season) => season.order >= 1)
    .map((season) => {
      const episodes = season.episodes ?? [];
      const dates = episodes.flatMap((e) => (e.air_date ? [e.air_date] : [])).sort();
      return {
        number: season.order,
        title: GENERIC_NAME.test(season.name?.trim() ?? '') ? null : emptyToNull(season.name),
        overview: null,
        firstAirDate: dates[0] ?? null,
        episodeCount: episodes.length,
        posterUrl: null,
      };
    })
    .sort((a, b) => a.number - b.number);
}
