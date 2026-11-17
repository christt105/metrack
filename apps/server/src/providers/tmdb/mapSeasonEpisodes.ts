import type { Episode } from '@metrack/domain';
import type { TmdbEpisodeGroup } from './TmdbEpisodeGroup.js';
import type { TmdbSeasonResponse } from './TmdbSeasonResponse.js';
import { clean, emptyToNull } from './mapTitle.js';

/** The episodes of a regular TMDB season, numbered as TMDB numbers them. */
export function mapSeasonEpisodes(response: TmdbSeasonResponse): Episode[] {
  return (response.episodes ?? [])
    .map((e) => ({
      number: e.episode_number,
      title: emptyToNull(e.name),
      airDate: emptyToNull(e.air_date ?? undefined),
      runtime: e.runtime && e.runtime > 0 ? e.runtime : null,
      tmdbId: e.id ?? null,
      overview: clean(e.overview),
    }))
    .sort((a, b) => a.number - b.number);
}

/**
 * The episodes of one season of an episode group, numbered by their place in the group; null when the group has
 * no season with that order.
 */
export function mapGroupSeasonEpisodes(group: TmdbEpisodeGroup, order: number): Episode[] | null {
  const season = (group.groups ?? []).find((s) => s.order === order);
  if (!season) return null;
  return [...(season.episodes ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e, index) => ({
      number: index + 1,
      title: emptyToNull(e.name),
      airDate: emptyToNull(e.air_date ?? undefined),
      runtime: e.runtime && e.runtime > 0 ? e.runtime : null,
      tmdbId: e.id ?? null,
      overview: clean(e.overview),
    }));
}
