import type { Season } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { seasonTable } from '../mapping/seasonTable.js';
import type { SeasonRepository } from '../repositories/SeasonRepository.js';
import type { D1Database } from './D1Database.js';
import { D1TableRepository } from './D1TableRepository.js';

export class D1SeasonRepository extends D1TableRepository<Season> implements SeasonRepository {
  constructor(db: D1Database, scope: UserScope) {
    super(db, scope, seasonTable);
  }

  async listBySeries(seriesId: number): Promise<Season[]> {
    return this.where('c.series_id = ? ORDER BY c.number', seriesId);
  }
}
