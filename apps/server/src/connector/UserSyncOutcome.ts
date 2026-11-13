import type { SyncApplyResult, SyncPlan } from '@metrack/domain';

/** What one sync of one user computed and, when it applied the plan, what that did. */
export interface UserSyncOutcome {
  plan: SyncPlan;
  /** Undefined when nothing was applied: a report, or a plan with no changes. */
  result?: SyncApplyResult;
  /** Titles the plan created whose metadata was asked for, and how many of those requests failed. */
  created: number;
  refreshFailures: number;
}
