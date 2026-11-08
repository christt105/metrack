import type { SeasonOverride } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { seasonOverrideFromRow } from '../mapping/seasonOverrideFromRow.js';
import type { SeasonOverrideRepository } from '../repositories/SeasonOverrideRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll } from './d1Query.js';

export class D1SeasonOverrideRepository implements SeasonOverrideRepository {
  constructor(
    private readonly db: D1Database,
    private readonly scope: UserScope,
  ) {}

  async set(override: SeasonOverride): Promise<SeasonOverride> {
    await execute(
      this.db,
      `INSERT OR REPLACE INTO season_override (user_id, series_id, tmdb_season_number, number, title, jellyfin_season_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      this.scope.userId(),
      override.seriesId,
      override.tmdbSeasonNumber,
      override.number,
      override.title,
      override.jellyfinSeasonId,
    );
    return override;
  }

  async listBySeries(seriesId: number): Promise<SeasonOverride[]> {
    const rows = await queryAll(
      this.db,
      'SELECT * FROM season_override WHERE user_id = ? AND series_id = ? ORDER BY tmdb_season_number',
      this.scope.userId(),
      seriesId,
    );
    return rows.map(seasonOverrideFromRow);
  }

  async delete(seriesId: number, tmdbSeasonNumber: number): Promise<boolean> {
    const meta = await execute(
      this.db,
      'DELETE FROM season_override WHERE user_id = ? AND series_id = ? AND tmdb_season_number = ?',
      this.scope.userId(),
      seriesId,
      tmdbSeasonNumber,
    );
    return meta.changes > 0;
  }
}
