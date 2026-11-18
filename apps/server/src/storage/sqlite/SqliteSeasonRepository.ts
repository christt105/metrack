import type { DatabaseSync } from 'node:sqlite';
import type { Season } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { SEASON_PERSONAL_DATA_SQL } from '../mapping/seasonPersonalDataSql.js';
import { seasonTable } from '../mapping/seasonTable.js';
import type { SeasonRepository } from '../repositories/SeasonRepository.js';
import { SqliteTableRepository } from './SqliteTableRepository.js';

export class SqliteSeasonRepository
  extends SqliteTableRepository<Season>
  implements SeasonRepository
{
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, seasonTable);
  }

  async listBySeries(seriesId: number): Promise<Season[]> {
    return this.where('c.series_id = ? ORDER BY c.number', seriesId);
  }

  async unlinkProviderSeasons(seriesId: number): Promise<void> {
    this.db
      .prepare('UPDATE season SET tmdb_season_number = NULL WHERE series_id = ?')
      .run(seriesId);
  }

  async hasPersonalData(seasonId: number): Promise<boolean> {
    return this.db.prepare(SEASON_PERSONAL_DATA_SQL).get(seasonId) !== undefined;
  }

  async deleteForAll(seasonId: number): Promise<void> {
    this.db.prepare('DELETE FROM season WHERE id = ?').run(seasonId);
  }
}
