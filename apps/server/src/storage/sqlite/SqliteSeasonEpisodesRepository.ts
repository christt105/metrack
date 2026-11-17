import type { DatabaseSync } from 'node:sqlite';
import type { SeasonEpisodes } from '@metrack/domain';
import { UPSERT_CATALOG_SQL } from '../mapping/episodeWatchesSql.js';
import { seasonEpisodesFromRow, seasonEpisodesToRow } from '../mapping/seasonEpisodesFromRow.js';
import type { SeasonEpisodesRepository } from '../repositories/SeasonEpisodesRepository.js';

export class SqliteSeasonEpisodesRepository implements SeasonEpisodesRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(seasonId: number): Promise<SeasonEpisodes | undefined> {
    const row = this.db.prepare('SELECT * FROM season_episodes WHERE season_id = ?').get(seasonId);
    return row ? seasonEpisodesFromRow(row) : undefined;
  }

  async put(catalog: SeasonEpisodes): Promise<void> {
    this.db.prepare(UPSERT_CATALOG_SQL).run(...seasonEpisodesToRow(catalog));
  }
}
