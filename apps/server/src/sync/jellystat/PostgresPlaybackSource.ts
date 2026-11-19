import type { PlayRecord } from '@metrack/domain';
import type { PlaybackSource } from '../PlaybackSource.js';
import type { SqlQuery } from './SqlQuery.js';

/**
 * Jellystat stores one row per real playback session in `jf_playback_activity`. Episodes carry the
 * series in `NowPlayingItemId` and their own id in `EpisodeId`; movies only have `NowPlayingItemId`.
 * Items marked as watched by hand never create a row; the planner dates them from the companion accounts' rows.
 */
const SELECT = `
  SELECT COALESCE("EpisodeId", "NowPlayingItemId") AS item_id,
         COALESCE("SeriesName", "NowPlayingItemName") AS title,
         "ActivityDateInserted" AS played_at,
         "PlaybackDuration" AS seconds
  FROM jf_playback_activity`;
const OWN_QUERY = `${SELECT}
  WHERE "UserName" = $1 AND "PlaybackDuration" > 0
  ORDER BY "ActivityDateInserted"`;
const COMPANION_QUERY = `${SELECT}
  WHERE "UserName" = ANY($1::text[]) AND "PlaybackDuration" > 0
  ORDER BY "ActivityDateInserted"`;

/** Reads the playback of one Jellyfin account, and of its companion accounts, from the Jellystat database. Read-only. */
export class PostgresPlaybackSource implements PlaybackSource {
  constructor(
    private readonly db: SqlQuery,
    private readonly userName: string,
    private readonly companions: readonly string[] = [],
  ) {}

  async listPlays(): Promise<PlayRecord[]> {
    return this.read(OWN_QUERY, this.userName);
  }

  async listCompanionPlays(): Promise<PlayRecord[] | undefined> {
    if (this.companions.length === 0) return undefined;
    return this.read(COMPANION_QUERY, [...this.companions]);
  }

  private async read(query: string, param: string | string[]): Promise<PlayRecord[]> {
    const { rows } = await this.db.query(query, [param]);
    return rows.map((row) => ({
      itemId: String(row.item_id),
      title: row.title === null ? undefined : String(row.title),
      playedAt: new Date(row.played_at as string | Date).toISOString(),
      watchedSeconds: Number(row.seconds),
    }));
  }
}
