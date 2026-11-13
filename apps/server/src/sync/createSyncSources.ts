import type { Pool } from 'pg';
import type { FetchFn } from '../http/FetchFn.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import { JellyfinClient } from './jellyfin/JellyfinClient.js';
import { JellyfinLibrarySource } from './jellyfin/JellyfinLibrarySource.js';
import { PostgresPlaybackSource } from './jellystat/PostgresPlaybackSource.js';
import type { SyncConfig } from './SyncConfig.js';
import type { SyncSources } from './SyncSources.js';
import { TvdbResolvingLibrarySource } from './TvdbResolvingLibrarySource.js';

/**
 * The real Jellyfin API and the Jellystat database (`pool`, see `openJellystatPool`) for one Jellyfin account. With
 * a TMDB client, series Jellyfin only knows by their TheTVDB id are paired through TMDB.
 */
export function createSyncSources(
  config: SyncConfig,
  jellyfinUser: string,
  pool: Pool,
  tmdb?: TmdbClient,
  fetchFn: FetchFn = fetch,
): SyncSources {
  const jellyfin = new JellyfinLibrarySource(
    new JellyfinClient(fetchFn, { ...config.jellyfin, userName: jellyfinUser }),
  );
  return {
    library: tmdb
      ? new TvdbResolvingLibrarySource(jellyfin, (id) => tmdb.seriesIdForTvdb(id))
      : jellyfin,
    playback: new PostgresPlaybackSource(pool, jellyfinUser),
  };
}
