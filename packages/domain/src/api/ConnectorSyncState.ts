import type { SyncState } from '../sync/SyncState.js';
import type { EntityRef } from './EntityRef.js';

/**
 * What the connector compares Jellyfin against, the content version it was read at, and the user's titles that have
 * a TMDB id but no metadata yet, which the connector asks for after every sync.
 */
export interface ConnectorSyncState {
  contentVersion: number;
  state: SyncState;
  unfetched: EntityRef[];
}
