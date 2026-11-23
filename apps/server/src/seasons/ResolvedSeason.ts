import type { Episode, Season, SeasonEpisodes } from '@metrack/domain';

/** A season with its catalog, and the episodes to go by: the catalog's, or bare numbers without one. */
export interface ResolvedSeason {
  season: Season;
  catalog: SeasonEpisodes | undefined;
  episodes: readonly Episode[];
  episodeCountChanged: boolean;
}
