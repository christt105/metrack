import type { SyncApplyResult } from '../sync/SyncApplyResult.js';
import type { EntityRef } from './EntityRef.js';

/** What applying a plan did, and the titles it created, whose metadata the connector then asks for one by one. */
export interface ConnectorSyncResponse {
  result: SyncApplyResult;
  created: EntityRef[];
}
