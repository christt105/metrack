import type { Season } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { SEASON_PERSONAL_DATA_SQL } from '../mapping/seasonPersonalDataSql.js';
import { seasonTable } from '../mapping/seasonTable.js';
import type { SeasonRepository } from '../repositories/SeasonRepository.js';
import type { D1Database } from './D1Database.js';
import { D1TableRepository } from './D1TableRepository.js';
import { execute, queryFirst } from './d1Query.js';

export class D1SeasonRepository extends D1TableRepository<Season> implements SeasonRepository {
  constructor(db: D1Database, scope: UserScope) {
    super(db, scope, seasonTable);
  }

  async listBySeries(seriesId: number): Promise<Season[]> {
    return this.where('c.series_id = ? ORDER BY c.number', seriesId);
  }

  async unlinkProviderSeasons(seriesId: number): Promise<void> {
    await execute(
      this.db,
      'UPDATE season SET tmdb_season_number = NULL WHERE series_id = ?',
      seriesId,
    );
  }

  async hasPersonalData(seasonId: number): Promise<boolean> {
    return (await queryFirst(this.db, SEASON_PERSONAL_DATA_SQL, seasonId)) !== undefined;
  }

  async deleteForAll(seasonId: number): Promise<void> {
    await execute(this.db, 'DELETE FROM season WHERE id = ?', seasonId);
  }
}
