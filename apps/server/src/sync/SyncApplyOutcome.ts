import type { EntityRef, SyncApplyResult } from '@metrack/domain';

/** What a sync apply wrote: the counts, and the movies and series it created. */
export interface SyncApplyOutcome {
  result: SyncApplyResult;
  created: EntityRef[];
}
