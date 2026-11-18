import type { EpisodeWatches, SeasonEntryUpdate } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { episodeWatchesFromRow } from '../mapping/episodeWatchesFromRow.js';
import { UPDATE_TRACKING_SQL, UPSERT_WATCHES_SQL } from '../mapping/episodeWatchesSql.js';
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

  async list(): Promise<StoredEpisodeWatches[]> {
    const rows = await queryAll(
      this.db,
      'SELECT * FROM series_episode_entry WHERE user_id = ? ORDER BY series_id',
      this.scope.userId(),
    );
    return rows.map(episodeWatchesFromRow);
  }

  async set(
    seriesId: number,
    watched: EpisodeWatches,
    seasons: readonly SeasonEntryUpdate[] = [],
  ): Promise<void> {
    await this.replace(this.scope.userId(), seriesId, watched, seasons);
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
  ): Promise<void> {
    await this.db.batch([
      statement(this.db, UPSERT_WATCHES_SQL, [userId, seriesId, JSON.stringify(watched)]),
      ...seasons.map((update) =>
        statement(this.db, UPDATE_TRACKING_SQL, seasonEntryUpdateParams(userId, update)),
      ),
    ]);
  }
}
