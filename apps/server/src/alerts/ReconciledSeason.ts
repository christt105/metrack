import type { Season } from '@metrack/domain';

/** A local season together with the date the release source gives for its premiere. */
export interface ReconciledSeason {
  season: Season;
  airDate: string;
  created: boolean;
}
