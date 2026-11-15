import type { Season } from './Season.js';

/** The catalog fields of one stored season that differ from what the provider says, and the cover to fetch if it has none. */
export interface SeasonRefreshUpdate {
  seasonId: number;
  fields: Partial<
    Pick<Season, 'tmdbSeasonNumber' | 'title' | 'overview' | 'firstAirDate' | 'episodeCount'>
  >;
  coverUrl: string | null;
}
