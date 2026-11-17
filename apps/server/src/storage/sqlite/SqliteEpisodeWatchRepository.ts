import type { DatabaseSync } from 'node:sqlite';
import { countWatchedEpisodes, type EpisodeWatches } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { episodeWatchesFromRow } from '../mapping/episodeWatchesFromRow.js';
import { UPDATE_WATCHED_COUNT_SQL, UPSERT_WATCHES_SQL } from '../mapping/episodeWatchesSql.js';
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

  async set(seasonId: number, watched: EpisodeWatches): Promise<void> {
    await this.replace(this.scope.userId(), seasonId, watched);
  }

  async listForSeason(seasonId: number): Promise<StoredEpisodeWatches[]> {
    return this.db
      .prepare('SELECT * FROM season_episode_entry WHERE season_id = ? ORDER BY user_id')
      .all(seasonId)
      .map(episodeWatchesFromRow);
  }

  async replace(userId: number, seasonId: number, watched: EpisodeWatches): Promise<void> {
    this.db.prepare(UPSERT_WATCHES_SQL).run(userId, seasonId, JSON.stringify(watched));
    this.db.prepare(UPDATE_WATCHED_COUNT_SQL).run(countWatchedEpisodes(watched), userId, seasonId);
  }
}
