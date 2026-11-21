import type { DatabaseSync } from 'node:sqlite';
import {
  DELETE_SERIES_FILLER_SQL,
  INSERT_SEASON_FILLER_SQL,
  SELECT_SEASON_FILLER_SQL,
  seasonFillerFromRow,
  seasonFillerToRow,
} from '../mapping/seasonFillerSql.js';
import type { SeasonFiller } from '../repositories/SeasonFiller.js';
import type { SeasonFillerRepository } from '../repositories/SeasonFillerRepository.js';

export class SqliteSeasonFillerRepository implements SeasonFillerRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(seasonId: number): Promise<SeasonFiller | undefined> {
    const row = this.db.prepare(SELECT_SEASON_FILLER_SQL).get(seasonId);
    return row ? seasonFillerFromRow(row) : undefined;
  }

  async replaceForSeries(seriesId: number, seasons: readonly SeasonFiller[]): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db.prepare(DELETE_SERIES_FILLER_SQL).run(seriesId);
      const insert = this.db.prepare(INSERT_SEASON_FILLER_SQL);
      for (const season of seasons) insert.run(...seasonFillerToRow(season));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
