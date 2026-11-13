import type { SyncState } from '@metrack/domain';

/** The movies, series and seasons a sync plan names, as the user has them. */
export type PlanTitles = Pick<SyncState, 'movies' | 'series' | 'seasons'>;
