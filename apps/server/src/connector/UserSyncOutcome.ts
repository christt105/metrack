import type { SyncApplyResult, SyncPlan } from '@metrack/domain';

/** What one sync of one user computed and, when it applied the plan, what that did. */
export interface UserSyncOutcome {
  plan: SyncPlan;
  /** Undefined when nothing was applied: a report, or a plan with no changes. */
  result?: SyncApplyResult;
  /** Titles the plan created. */
  created: number;
  /** Titles the user already had without metadata when the sync read the state. */
  unfetched: number;
  /** How many of the created and unfetched titles got their metadata. */
  refreshed: number;
}
