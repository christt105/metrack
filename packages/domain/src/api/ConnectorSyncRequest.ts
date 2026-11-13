import type { SyncPlan } from '../sync/SyncPlan.js';

/** A plan the connector computed, and the content version of the state it was computed from. */
export interface ConnectorSyncRequest {
  contentVersion: number;
  plan: SyncPlan;
}
