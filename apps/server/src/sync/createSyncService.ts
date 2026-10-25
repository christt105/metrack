import type { DatabaseSync } from 'node:sqlite';
import type { Pool } from 'pg';
import type { FetchFn } from '../http/FetchFn.js';
import { JellyfinClient } from './jellyfin/JellyfinClient.js';
import { JellyfinLibrarySource } from './jellyfin/JellyfinLibrarySource.js';
import { openJellystatPool } from './jellystat/openJellystatPool.js';
import { PostgresPlaybackSource } from './jellystat/PostgresPlaybackSource.js';
import { SyncApplier } from './SyncApplier.js';
import type { SyncConfig } from './SyncConfig.js';
import { SyncService } from './SyncService.js';
import type { SyncTargets } from './SyncTargets.js';

/** Wires the real Jellyfin API and the Jellystat database. The caller ends `pool`. */
export function createSyncService(
  config: SyncConfig,
  db: DatabaseSync,
  targets: SyncTargets,
  fetchFn: FetchFn = fetch,
): { service: SyncService; pool: Pool } {
  const pool = openJellystatPool(config.jellystat);
  const service = new SyncService(
    new JellyfinLibrarySource(new JellyfinClient(fetchFn, config.jellyfin)),
    new PostgresPlaybackSource(pool, config.userName),
    targets,
    new SyncApplier(db, targets),
    { timeZone: config.timeZone },
  );
  return { service, pool };
}
