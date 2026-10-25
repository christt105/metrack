import type { DatabaseSync } from 'node:sqlite';
import type { SeasonOverride } from '@metrack/domain';
import { num, text } from './rowMapping.js';

export class SeasonOverrideRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Inserts or replaces the override for a series and TMDB season number. */
  set(override: SeasonOverride): SeasonOverride {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO season_override (series_id, tmdb_season_number, number, title, jellyfin_season_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        override.seriesId,
        override.tmdbSeasonNumber,
        override.number,
        override.title,
        override.jellyfinSeasonId,
      );
    return override;
  }

  listBySeries(seriesId: number): SeasonOverride[] {
    return this.db
      .prepare('SELECT * FROM season_override WHERE series_id = ? ORDER BY tmdb_season_number')
      .all(seriesId)
      .map((row) => ({
        seriesId: Number(row.series_id),
        tmdbSeasonNumber: Number(row.tmdb_season_number),
        number: num(row.number),
        title: text(row.title),
        jellyfinSeasonId: text(row.jellyfin_season_id),
      }));
  }

  delete(seriesId: number, tmdbSeasonNumber: number): boolean {
    return (
      Number(
        this.db
          .prepare('DELETE FROM season_override WHERE series_id = ? AND tmdb_season_number = ?')
          .run(seriesId, tmdbSeasonNumber).changes,
      ) > 0
    );
  }
}
