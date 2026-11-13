import type { SyncApplyResult, SyncPlan } from '@metrack/domain';

/** What one sync of one user computed and, when it applied the plan, what that did. */
export interface UserSyncOutcome {
  plan: SyncPlan;
  /** Undefined when nothing was applied: a report, or a plan with no changes. */
  result?: SyncApplyResult;
  /** Titles the plan created, and how many of them got their metadata. */
  created: number;
  refreshed: number;
}
