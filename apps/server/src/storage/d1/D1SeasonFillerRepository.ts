import {
  DELETE_SERIES_FILLER_SQL,
  INSERT_SEASON_FILLER_SQL,
  SELECT_SEASON_FILLER_SQL,
  seasonFillerFromRow,
  seasonFillerToRow,
} from '../mapping/seasonFillerSql.js';
import type { SeasonFiller } from '../repositories/SeasonFiller.js';
import type { SeasonFillerRepository } from '../repositories/SeasonFillerRepository.js';
import type { D1Database } from './D1Database.js';
import { queryFirst, statement } from './d1Query.js';

export class D1SeasonFillerRepository implements SeasonFillerRepository {
  constructor(private readonly db: D1Database) {}

  async get(seasonId: number): Promise<SeasonFiller | undefined> {
    const row = await queryFirst(this.db, SELECT_SEASON_FILLER_SQL, seasonId);
    return row ? seasonFillerFromRow(row) : undefined;
  }

  async replaceForSeries(seriesId: number, seasons: readonly SeasonFiller[]): Promise<void> {
    await this.db.batch([
      statement(this.db, DELETE_SERIES_FILLER_SQL, [seriesId]),
      ...seasons.map((season) =>
        statement(this.db, INSERT_SEASON_FILLER_SQL, seasonFillerToRow(season)),
      ),
    ]);
  }
}
