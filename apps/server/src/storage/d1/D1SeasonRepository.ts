import type { Season } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { completedEntryFromRow } from '../mapping/completedEntryFromRow.js';
import { COMPLETED_ENTRIES_SQL, REOPEN_ENTRY_SQL } from '../mapping/completedEntriesSql.js';
import { SEASON_PERSONAL_DATA_SQL } from '../mapping/seasonPersonalDataSql.js';
import { seasonTable } from '../mapping/seasonTable.js';
import type { CompletedSeasonEntry } from '../repositories/CompletedSeasonEntry.js';
import type { SeasonRepository } from '../repositories/SeasonRepository.js';
import type { D1Database } from './D1Database.js';
import { D1TableRepository } from './D1TableRepository.js';
import { execute, queryAll, queryFirst, statement } from './d1Query.js';

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

  async hasPersonalData(seasonId: number, episodeKeys: readonly string[]): Promise<boolean> {
    return (
      (await queryFirst(
        this.db,
        SEASON_PERSONAL_DATA_SQL,
        seasonId,
        JSON.stringify(episodeKeys),
      )) !== undefined
    );
  }

  async listCompletedEntries(seasonId: number): Promise<CompletedSeasonEntry[]> {
    return (await queryAll(this.db, COMPLETED_ENTRIES_SQL, seasonId)).map(completedEntryFromRow);
  }

  async reopenEntries(seasonId: number, userIds: readonly number[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.db.batch(
      userIds.map((userId) => statement(this.db, REOPEN_ENTRY_SQL, [seasonId, userId])),
    );
  }

  async deleteForAll(seasonId: number): Promise<void> {
    await execute(this.db, 'DELETE FROM season WHERE id = ?', seasonId);
  }
}
