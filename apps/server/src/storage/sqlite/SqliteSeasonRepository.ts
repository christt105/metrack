import type { DatabaseSync } from 'node:sqlite';
import type { Season } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { completedEntryFromRow } from '../mapping/completedEntryFromRow.js';
import { COMPLETED_ENTRIES_SQL, REOPEN_ENTRY_SQL } from '../mapping/completedEntriesSql.js';
import { SEASON_PERSONAL_DATA_SQL } from '../mapping/seasonPersonalDataSql.js';
import { seasonTable } from '../mapping/seasonTable.js';
import type { CompletedSeasonEntry } from '../repositories/CompletedSeasonEntry.js';
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

  async hasPersonalData(seasonId: number, episodeKeys: readonly string[]): Promise<boolean> {
    return (
      this.db.prepare(SEASON_PERSONAL_DATA_SQL).get(seasonId, JSON.stringify(episodeKeys)) !==
      undefined
    );
  }

  async listCompletedEntries(seasonId: number): Promise<CompletedSeasonEntry[]> {
    return this.db.prepare(COMPLETED_ENTRIES_SQL).all(seasonId).map(completedEntryFromRow);
  }

  async reopenEntries(seasonId: number, userIds: readonly number[]): Promise<void> {
    for (const userId of userIds) this.db.prepare(REOPEN_ENTRY_SQL).run(seasonId, userId);
  }

  async deleteForAll(seasonId: number): Promise<void> {
    this.db.prepare('DELETE FROM season WHERE id = ?').run(seasonId);
  }
}
