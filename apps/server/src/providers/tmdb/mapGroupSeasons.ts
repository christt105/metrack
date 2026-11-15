import type { ProviderSeason } from '@metrack/domain';
import { emptyToNull } from './mapTitle.js';
import type { TmdbEpisodeGroup } from './TmdbEpisodeGroup.js';

/** The seasons of an episode group, numbered by `order`; order 0 holds the specials and is left out. */
export function mapGroupSeasons(group: TmdbEpisodeGroup): ProviderSeason[] {
  return (group.groups ?? [])
    .filter((season) => season.order >= 1)
    .map((season) => {
      const episodes = season.episodes ?? [];
      const dates = episodes.flatMap((e) => (e.air_date ? [e.air_date] : [])).sort();
      return {
        number: season.order,
        title: emptyToNull(season.name),
        overview: null,
        firstAirDate: dates[0] ?? null,
        episodeCount: episodes.length,
        posterUrl: null,
      };
    })
    .sort((a, b) => a.number - b.number);
}
