import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { SeasonOverride } from '@metrack/domain';
import type { SeasonOverrideRepository } from '../repositories/SeasonOverrideRepository.js';
import { num, text } from './rowMapping.js';

export class SqliteSeasonOverrideRepository implements SeasonOverrideRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly scope: UserScope,
  ) {}

  async set(override: SeasonOverride): Promise<SeasonOverride> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO season_override (user_id, series_id, tmdb_season_number, number, title, jellyfin_season_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
    return this.db
      .prepare(
        'SELECT * FROM season_override WHERE user_id = ? AND series_id = ? ORDER BY tmdb_season_number',
      )
      .all(this.scope.userId(), seriesId)
      .map((row) => ({
        seriesId: Number(row.series_id),
        tmdbSeasonNumber: Number(row.tmdb_season_number),
        number: num(row.number),
        title: text(row.title),
        jellyfinSeasonId: text(row.jellyfin_season_id),
      }));
  }

  async delete(seriesId: number, tmdbSeasonNumber: number): Promise<boolean> {
    return (
      Number(
        this.db
          .prepare(
            'DELETE FROM season_override WHERE user_id = ? AND series_id = ? AND tmdb_season_number = ?',
          )
          .run(this.scope.userId(), seriesId, tmdbSeasonNumber).changes,
      ) > 0
    );
  }
}
