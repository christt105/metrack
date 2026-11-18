import type { SeasonEpisodes } from '@metrack/domain';
import { DELETE_SERIES_CATALOGS_SQL, UPSERT_CATALOG_SQL } from '../mapping/episodeWatchesSql.js';
import { seasonEpisodesFromRow, seasonEpisodesToRow } from '../mapping/seasonEpisodesFromRow.js';
import type { SeasonEpisodesRepository } from '../repositories/SeasonEpisodesRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryFirst } from './d1Query.js';

export class D1SeasonEpisodesRepository implements SeasonEpisodesRepository {
  constructor(private readonly db: D1Database) {}

  async get(seasonId: number): Promise<SeasonEpisodes | undefined> {
    const row = await queryFirst(
      this.db,
      'SELECT * FROM season_episodes WHERE season_id = ?',
      seasonId,
    );
    return row ? seasonEpisodesFromRow(row) : undefined;
  }

  async put(catalog: SeasonEpisodes): Promise<void> {
    await execute(this.db, UPSERT_CATALOG_SQL, ...seasonEpisodesToRow(catalog));
  }

  async deleteForSeries(seriesId: number): Promise<void> {
    await execute(this.db, DELETE_SERIES_CATALOGS_SQL, seriesId);
  }
}
