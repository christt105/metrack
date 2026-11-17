import type { SeasonEpisodes } from '@metrack/domain';

/** The shared episode catalog, one row per season. Not scoped to a user. */
export interface SeasonEpisodesRepository {
  get(seasonId: number): Promise<SeasonEpisodes | undefined>;
  /** Inserts or replaces the catalog of the season. */
  put(catalog: SeasonEpisodes): Promise<void>;
}
