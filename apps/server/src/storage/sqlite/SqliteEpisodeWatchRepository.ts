import type { DatabaseSync } from 'node:sqlite';
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

export class SqliteEpisodeWatchRepository implements EpisodeWatchRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly scope: UserScope,
  ) {}

  async get(seasonId: number): Promise<EpisodeWatches | undefined> {
    const row = this.db
      .prepare('SELECT * FROM season_episode_entry WHERE user_id = ? AND season_id = ?')
      .get(this.scope.userId(), seasonId);
    return row ? episodeWatchesFromRow(row).watched : undefined;
  }

  async list(): Promise<StoredEpisodeWatches[]> {
    return this.db
      .prepare('SELECT * FROM season_episode_entry WHERE user_id = ? ORDER BY season_id')
      .all(this.scope.userId())
      .map(episodeWatchesFromRow);
  }

  async set(seasonId: number, watched: EpisodeWatches, tracking?: SeasonTracking): Promise<void> {
    await this.replace(this.scope.userId(), seasonId, watched, tracking);
  }

  async listForSeason(seasonId: number): Promise<StoredEpisodeWatches[]> {
    return this.db
      .prepare('SELECT * FROM season_episode_entry WHERE season_id = ? ORDER BY user_id')
      .all(seasonId)
      .map(episodeWatchesFromRow);
  }

  async replace(
    userId: number,
    seasonId: number,
    watched: EpisodeWatches,
    tracking?: SeasonTracking,
  ): Promise<void> {
    const own = !this.db.isTransaction;
    if (own) this.db.exec('BEGIN');
    try {
      this.db.prepare(UPSERT_WATCHES_SQL).run(userId, seasonId, JSON.stringify(watched));
      const count = countWatchedEpisodes(watched);
      if (tracking) {
        this.db
          .prepare(UPDATE_TRACKING_SQL)
          .run(
            count,
            tracking.status,
            tracking.startedAt,
            tracking.finishedAt,
            JSON.stringify(normalizeViewings(tracking.rewatches)),
            userId,
            seasonId,
          );
      } else {
        this.db.prepare(UPDATE_WATCHED_COUNT_SQL).run(count, userId, seasonId);
      }
      if (own) this.db.exec('COMMIT');
    } catch (error) {
      if (own) this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
