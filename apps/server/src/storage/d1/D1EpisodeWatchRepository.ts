import {
  countWatchedEpisodes,
  normalizeViewings,
  type EpisodeWatches,
  type SeasonTracking,
} from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { episodeWatchesFromRow } from '../mapping/episodeWatchesFromRow.js';
import {
  UPDATE_TRACKING_SQL,
  UPDATE_WATCHED_COUNT_SQL,
  UPSERT_WATCHES_SQL,
} from '../mapping/episodeWatchesSql.js';
import type { EpisodeWatchRepository } from '../repositories/EpisodeWatchRepository.js';
import type { StoredEpisodeWatches } from '../repositories/StoredEpisodeWatches.js';
import type { D1Database } from './D1Database.js';
import { queryAll, queryFirst, statement } from './d1Query.js';

export class D1EpisodeWatchRepository implements EpisodeWatchRepository {
  constructor(
    private readonly db: D1Database,
    private readonly scope: UserScope,
  ) {}

  async get(seasonId: number): Promise<EpisodeWatches | undefined> {
    const row = await queryFirst(
      this.db,
      'SELECT * FROM season_episode_entry WHERE user_id = ? AND season_id = ?',
      this.scope.userId(),
      seasonId,
    );
    return row ? episodeWatchesFromRow(row).watched : undefined;
  }

  async list(): Promise<StoredEpisodeWatches[]> {
    const rows = await queryAll(
      this.db,
      'SELECT * FROM season_episode_entry WHERE user_id = ? ORDER BY season_id',
      this.scope.userId(),
    );
    return rows.map(episodeWatchesFromRow);
  }

  async set(seasonId: number, watched: EpisodeWatches, tracking?: SeasonTracking): Promise<void> {
    await this.replace(this.scope.userId(), seasonId, watched, tracking);
  }

  async listForSeason(seasonId: number): Promise<StoredEpisodeWatches[]> {
    const rows = await queryAll(
      this.db,
      'SELECT * FROM season_episode_entry WHERE season_id = ? ORDER BY user_id',
      seasonId,
    );
    return rows.map(episodeWatchesFromRow);
  }

  async replace(
    userId: number,
    seasonId: number,
    watched: EpisodeWatches,
    tracking?: SeasonTracking,
  ): Promise<void> {
    const count = countWatchedEpisodes(watched);
    await this.db.batch([
      statement(this.db, UPSERT_WATCHES_SQL, [userId, seasonId, JSON.stringify(watched)]),
      tracking
        ? statement(this.db, UPDATE_TRACKING_SQL, [
            count,
            tracking.status,
            tracking.startedAt,
            tracking.finishedAt,
            JSON.stringify(normalizeViewings(tracking.rewatches)),
            userId,
            seasonId,
          ])
        : statement(this.db, UPDATE_WATCHED_COUNT_SQL, [count, userId, seasonId]),
    ]);
  }
}
