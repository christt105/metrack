import type { EntityRef, SyncApplyResult } from '@metrack/domain';

/** What a sync apply wrote: the counts, and the movies and series it created, plus the TMDB series it added seasons to, whose metadata is fetched again. */
export interface SyncApplyOutcome {
  result: SyncApplyResult;
  created: EntityRef[];
}
