import type { PlayRecord } from '@metrack/domain';
import type { PlaybackSource } from '../PlaybackSource.js';
import type { SqlQuery } from './SqlQuery.js';

/**
 * Jellystat stores one row per real playback session in `jf_playback_activity`. Episodes carry the
 * series in `NowPlayingItemId` and their own id in `EpisodeId`; movies only have `NowPlayingItemId`.
 * Items marked as watched by hand never create a row, so they are ignored by construction.
 */
const QUERY = `
  SELECT COALESCE("EpisodeId", "NowPlayingItemId") AS item_id,
         COALESCE("SeriesName", "NowPlayingItemName") AS title,
         "ActivityDateInserted" AS played_at,
         "PlaybackDuration" AS seconds
  FROM jf_playback_activity
  WHERE "UserName" = $1 AND "PlaybackDuration" > 0
  ORDER BY "ActivityDateInserted"`;

/** Reads the playback of one Jellyfin account from the Jellystat database. Read-only. */
export class PostgresPlaybackSource implements PlaybackSource {
  constructor(
    private readonly db: SqlQuery,
    private readonly userName: string,
  ) {}

  async listPlays(): Promise<PlayRecord[]> {
    const { rows } = await this.db.query(QUERY, [this.userName]);
    return rows.map((row) => ({
      itemId: String(row.item_id),
      title: row.title === null ? undefined : String(row.title),
      playedAt: new Date(row.played_at as string | Date).toISOString(),
      watchedSeconds: Number(row.seconds),
    }));
  }
}
