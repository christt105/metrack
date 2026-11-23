import type { EpisodeWatches, SeasonEntryUpdate, UnmatchedEpisode } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { episodeWatchesFromRow } from '../mapping/episodeWatchesFromRow.js';
import {
  UPDATE_TRACKING_SQL,
  UPSERT_UNMATCHED_SQL,
  UPSERT_WATCHES_KEEP_SKIPPED_SQL,
  UPSERT_WATCHES_SQL,
} from '../mapping/episodeWatchesSql.js';
import { seasonEntryUpdateParams } from '../mapping/seasonEntryUpdateParams.js';
import type { EpisodeWatchRepository } from '../repositories/EpisodeWatchRepository.js';
import type { StoredEpisodeWatches } from '../repositories/StoredEpisodeWatches.js';
import type { D1Database } from './D1Database.js';
import { queryAll, queryFirst, statement } from './d1Query.js';

export class D1EpisodeWatchRepository implements EpisodeWatchRepository {
  constructor(
    private readonly db: D1Database,
    private readonly scope: UserScope,
  ) {}

  async get(seriesId: number): Promise<EpisodeWatches | undefined> {
    const row = await queryFirst(
      this.db,
      'SELECT * FROM series_episode_entry WHERE user_id = ? AND series_id = ?',
      this.scope.userId(),
      seriesId,
    );
    return row ? episodeWatchesFromRow(row).watched : undefined;
  }

  async getEntry(seriesId: number): Promise<StoredEpisodeWatches | undefined> {
    const row = await queryFirst(
      this.db,
      'SELECT * FROM series_episode_entry WHERE user_id = ? AND series_id = ?',
      this.scope.userId(),
      seriesId,
    );
    return row ? episodeWatchesFromRow(row) : undefined;
  }

  async setUnmatched(seriesId: number, unmatched: readonly UnmatchedEpisode[]): Promise<void> {
    await this.db.batch([
      statement(this.db, UPSERT_UNMATCHED_SQL, [
        this.scope.userId(),
        seriesId,
        JSON.stringify(unmatched),
      ]),
    ]);
  }

  async list(): Promise<StoredEpisodeWatches[]> {
    const rows = await queryAll(
      this.db,
      'SELECT * FROM series_episode_entry WHERE user_id = ? ORDER BY series_id',
      this.scope.userId(),
    );
    return rows.map(episodeWatchesFromRow);
  }

  async getSkipped(seriesId: number): Promise<string[]> {
    const row = await queryFirst(
      this.db,
      'SELECT * FROM series_episode_entry WHERE user_id = ? AND series_id = ?',
      this.scope.userId(),
      seriesId,
    );
    return row ? episodeWatchesFromRow(row).skipped : [];
  }

  async set(
    seriesId: number,
    watched: EpisodeWatches,
    seasons: readonly SeasonEntryUpdate[] = [],
    skipped?: readonly string[],
    activityAt?: string,
  ): Promise<void> {
    await this.replace(this.scope.userId(), seriesId, watched, seasons, skipped, activityAt);
  }

  async listForSeries(seriesId: number): Promise<StoredEpisodeWatches[]> {
    const rows = await queryAll(
      this.db,
      'SELECT * FROM series_episode_entry WHERE series_id = ? ORDER BY user_id',
      seriesId,
    );
    return rows.map(episodeWatchesFromRow);
  }

  async replace(
    userId: number,
    seriesId: number,
    watched: EpisodeWatches,
    seasons: readonly SeasonEntryUpdate[] = [],
    skipped?: readonly string[],
    activityAt?: string,
  ): Promise<void> {
    await this.db.batch([
      skipped === undefined
        ? statement(this.db, UPSERT_WATCHES_KEEP_SKIPPED_SQL, [
            userId,
            seriesId,
            JSON.stringify(watched),
            activityAt ?? null,
          ])
        : statement(this.db, UPSERT_WATCHES_SQL, [
            userId,
            seriesId,
            JSON.stringify(watched),
            JSON.stringify(skipped),
            activityAt ?? null,
          ]),
      ...seasons.map((update) =>
        statement(this.db, UPDATE_TRACKING_SQL, seasonEntryUpdateParams(userId, update)),
      ),
    ]);
  }
}
