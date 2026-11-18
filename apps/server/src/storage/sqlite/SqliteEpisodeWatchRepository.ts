import type { DatabaseSync } from 'node:sqlite';
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

export class SqliteEpisodeWatchRepository implements EpisodeWatchRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly scope: UserScope,
  ) {}

  async get(seriesId: number): Promise<EpisodeWatches | undefined> {
    const row = this.db
      .prepare('SELECT * FROM series_episode_entry WHERE user_id = ? AND series_id = ?')
      .get(this.scope.userId(), seriesId);
    return row ? episodeWatchesFromRow(row).watched : undefined;
  }

  async getEntry(seriesId: number): Promise<StoredEpisodeWatches | undefined> {
    const row = this.db
      .prepare('SELECT * FROM series_episode_entry WHERE user_id = ? AND series_id = ?')
      .get(this.scope.userId(), seriesId);
    return row ? episodeWatchesFromRow(row) : undefined;
  }

  async setUnmatched(seriesId: number, unmatched: readonly UnmatchedEpisode[]): Promise<void> {
    this.db
      .prepare(UPSERT_UNMATCHED_SQL)
      .run(this.scope.userId(), seriesId, JSON.stringify(unmatched));
  }

  async list(): Promise<StoredEpisodeWatches[]> {
    return this.db
      .prepare('SELECT * FROM series_episode_entry WHERE user_id = ? ORDER BY series_id')
      .all(this.scope.userId())
      .map(episodeWatchesFromRow);
  }

  async getSkipped(seriesId: number): Promise<string[]> {
    const row = this.db
      .prepare('SELECT * FROM series_episode_entry WHERE user_id = ? AND series_id = ?')
      .get(this.scope.userId(), seriesId);
    return row ? episodeWatchesFromRow(row).skipped : [];
  }

  async set(
    seriesId: number,
    watched: EpisodeWatches,
    seasons: readonly SeasonEntryUpdate[] = [],
    skipped?: readonly string[],
  ): Promise<void> {
    await this.replace(this.scope.userId(), seriesId, watched, seasons, skipped);
  }

  async listForSeries(seriesId: number): Promise<StoredEpisodeWatches[]> {
    return this.db
      .prepare('SELECT * FROM series_episode_entry WHERE series_id = ? ORDER BY user_id')
      .all(seriesId)
      .map(episodeWatchesFromRow);
  }

  async replace(
    userId: number,
    seriesId: number,
    watched: EpisodeWatches,
    seasons: readonly SeasonEntryUpdate[] = [],
    skipped?: readonly string[],
  ): Promise<void> {
    const own = !this.db.isTransaction;
    if (own) this.db.exec('BEGIN');
    try {
      if (skipped === undefined) {
        this.db
          .prepare(UPSERT_WATCHES_KEEP_SKIPPED_SQL)
          .run(userId, seriesId, JSON.stringify(watched));
      } else {
        this.db
          .prepare(UPSERT_WATCHES_SQL)
          .run(userId, seriesId, JSON.stringify(watched), JSON.stringify(skipped));
      }
      for (const update of seasons) {
        this.db.prepare(UPDATE_TRACKING_SQL).run(...seasonEntryUpdateParams(userId, update));
      }
      if (own) this.db.exec('COMMIT');
    } catch (error) {
      if (own) this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
