import { SEASONS_EPISODE_GROUP_TYPE } from '@metrack/domain';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { TmdbEpisodeGroup } from '../providers/tmdb/TmdbEpisodeGroup.js';

const MAX_GROUPS = 5;

/** Every "Seasons" episode group TMDB has for a series, in full. A series has one or two; more are not read. */
export async function loadSeasonsGroups(
  client: TmdbClient,
  tmdbId: number,
): Promise<TmdbEpisodeGroup[]> {
  const list = await client.episodeGroups(tmdbId);
  const seasons = (list.results ?? [])
    .filter((g) => g.type === SEASONS_EPISODE_GROUP_TYPE)
    .slice(0, MAX_GROUPS);
  return Promise.all(seasons.map((g) => client.episodeGroup(g.id)));
}
