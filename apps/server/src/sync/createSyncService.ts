import type { DatabaseSync } from 'node:sqlite';
import type { Pool } from 'pg';
import type { FetchFn } from '../http/FetchFn.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { Logger } from '../notify/Logger.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import { JellyfinClient } from './jellyfin/JellyfinClient.js';
import { JellyfinLibrarySource } from './jellyfin/JellyfinLibrarySource.js';
import { openJellystatPool } from './jellystat/openJellystatPool.js';
import { PostgresPlaybackSource } from './jellystat/PostgresPlaybackSource.js';
import { SyncApplier } from './SyncApplier.js';
import type { SyncConfig } from './SyncConfig.js';
import { SyncService } from './SyncService.js';
import type { SyncTargets } from './SyncTargets.js';
import { TvdbResolvingLibrarySource } from './TvdbResolvingLibrarySource.js';

/**
 * Wires the real Jellyfin API and the Jellystat database. The caller ends `pool`. With TMDB, series Jellyfin
 * only knows by their TheTVDB id are paired through TMDB, and created titles get their metadata and artwork.
 */
export function createSyncService(
  config: SyncConfig,
  db: DatabaseSync,
  targets: SyncTargets,
  logger: Logger,
  tmdb?: { client: TmdbClient; metadata: MetadataCache },
  fetchFn: FetchFn = fetch,
): { service: SyncService; pool: Pool } {
  const pool = openJellystatPool(config.jellystat, logger);
  const jellyfin = new JellyfinLibrarySource(new JellyfinClient(fetchFn, config.jellyfin));
  const service = new SyncService(
    tmdb
      ? new TvdbResolvingLibrarySource(jellyfin, (id) => tmdb.client.seriesIdForTvdb(id))
      : jellyfin,
    new PostgresPlaybackSource(pool, config.userName),
    targets,
    new SyncApplier(db, targets),
    {
      timeZone: config.timeZone,
      refreshCreated: tmdb && ((ref) => tmdb.metadata.refresh(ref.type, ref.id, true)),
    },
  );
  return { service, pool };
}
