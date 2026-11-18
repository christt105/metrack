import type { DatabaseSync } from 'node:sqlite';
import type { EpisodeWatches, SeasonEntryUpdate } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { episodeWatchesFromRow } from '../mapping/episodeWatchesFromRow.js';
import { UPDATE_TRACKING_SQL, UPSERT_WATCHES_SQL } from '../mapping/episodeWatchesSql.js';
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

  async list(): Promise<StoredEpisodeWatches[]> {
    return this.db
      .prepare('SELECT * FROM series_episode_entry WHERE user_id = ? ORDER BY series_id')
      .all(this.scope.userId())
      .map(episodeWatchesFromRow);
  }

  async set(
    seriesId: number,
    watched: EpisodeWatches,
    seasons: readonly SeasonEntryUpdate[] = [],
  ): Promise<void> {
    await this.replace(this.scope.userId(), seriesId, watched, seasons);
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
  ): Promise<void> {
    const own = !this.db.isTransaction;
    if (own) this.db.exec('BEGIN');
    try {
      this.db.prepare(UPSERT_WATCHES_SQL).run(userId, seriesId, JSON.stringify(watched));
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
