import type { DatabaseSync } from 'node:sqlite';
import type { SeasonEpisodes } from '@metrack/domain';
import {
  DELETE_SERIES_CATALOGS_SQL,
  SELECT_SERIES_CATALOGS_SQL,
  UPSERT_CATALOG_SQL,
} from '../mapping/episodeWatchesSql.js';
import { seasonEpisodesFromRow, seasonEpisodesToRow } from '../mapping/seasonEpisodesFromRow.js';
import type { SeasonEpisodesRepository } from '../repositories/SeasonEpisodesRepository.js';

export class SqliteSeasonEpisodesRepository implements SeasonEpisodesRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(seasonId: number): Promise<SeasonEpisodes | undefined> {
    const row = this.db.prepare('SELECT * FROM season_episodes WHERE season_id = ?').get(seasonId);
    return row ? seasonEpisodesFromRow(row) : undefined;
  }

  async listForSeries(seriesId: number): Promise<SeasonEpisodes[]> {
    return this.db.prepare(SELECT_SERIES_CATALOGS_SQL).all(seriesId).map(seasonEpisodesFromRow);
  }

  async put(catalog: SeasonEpisodes): Promise<void> {
    this.db.prepare(UPSERT_CATALOG_SQL).run(...seasonEpisodesToRow(catalog));
  }

  async deleteForSeries(seriesId: number): Promise<void> {
    this.db.prepare(DELETE_SERIES_CATALOGS_SQL).run(seriesId);
  }
}
