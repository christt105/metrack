import type { Pool } from 'pg';
import type { FetchFn } from '../http/FetchFn.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { TransactionRunner } from '../storage/repositories/TransactionRunner.js';
import { JellyfinClient } from './jellyfin/JellyfinClient.js';
import { JellyfinLibrarySource } from './jellyfin/JellyfinLibrarySource.js';
import { PostgresPlaybackSource } from './jellystat/PostgresPlaybackSource.js';
import { SyncApplier } from './SyncApplier.js';
import type { SyncConfig } from './SyncConfig.js';
import { SyncService } from './SyncService.js';
import type { SyncTargets } from './SyncTargets.js';
import { TvdbResolvingLibrarySource } from './TvdbResolvingLibrarySource.js';

/**
 * Wires the real Jellyfin API and the Jellystat database (`pool`, see `openJellystatPool`) for one Jellyfin account.
 * With TMDB, series Jellyfin only knows by their TheTVDB id are paired through TMDB, and created titles get their
 * metadata and artwork.
 */
export function createSyncService(
  config: SyncConfig,
  jellyfinUser: string,
  pool: Pool,
  transactions: TransactionRunner,
  targets: SyncTargets,
  tmdb?: { client: TmdbClient; metadata: MetadataCache },
  fetchFn: FetchFn = fetch,
): SyncService {
  const jellyfin = new JellyfinLibrarySource(
    new JellyfinClient(fetchFn, { ...config.jellyfin, userName: jellyfinUser }),
  );
  return new SyncService(
    tmdb
      ? new TvdbResolvingLibrarySource(jellyfin, (id) => tmdb.client.seriesIdForTvdb(id))
      : jellyfin,
    new PostgresPlaybackSource(pool, jellyfinUser),
    targets,
    new SyncApplier(transactions, targets),
    {
      timeZone: config.timeZone,
      refreshCreated: tmdb && ((ref) => tmdb.metadata.refresh(ref.type, ref.id, true)),
    },
  );
}
