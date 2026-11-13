import type { SyncState } from '../sync/SyncState.js';

/** What the connector compares Jellyfin against, and the content version it was read at. */
export interface ConnectorSyncState {
  contentVersion: number;
  state: SyncState;
}
