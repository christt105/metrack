import type { SeasonOverride } from '@metrack/domain';

export interface SeasonOverrideRepository {
  /** Inserts or replaces the override for a series and TMDB season number. */
  set(override: SeasonOverride): Promise<SeasonOverride>;
  listBySeries(seriesId: number): Promise<SeasonOverride[]>;
  /** Every override of the user, ordered by series and TMDB season number. */
  list(): Promise<SeasonOverride[]>;
  delete(seriesId: number, tmdbSeasonNumber: number): Promise<boolean>;
}
