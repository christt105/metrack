import type { DatabaseSync } from 'node:sqlite';
import type { Season } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
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
}
