import type { Series } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { seriesTable } from '../mapping/seriesTable.js';
import type { SeriesRepository } from '../repositories/SeriesRepository.js';
import type { D1Database } from './D1Database.js';
import { D1TableRepository } from './D1TableRepository.js';
import { execute, queryAll } from './d1Query.js';

export class D1SeriesRepository extends D1TableRepository<Series> implements SeriesRepository {
  constructor(db: D1Database, scope: UserScope) {
    super(db, scope, seriesTable);
  }

  async findByTmdbId(tmdbId: number): Promise<Series | undefined> {
    return this.findOneBy('tmdb_id', tmdbId);
  }

  async findByTvdbId(tvdbId: number): Promise<Series | undefined> {
    return this.findOneBy('tvdb_id', tvdbId);
  }

  async listFollowed(): Promise<Series[]> {
    return this.where('e.follow = 1 ORDER BY c.id');
  }

  async listNextHidden(): Promise<Map<number, string>> {
    const rows = await queryAll(
      this.db,
      'SELECT series_id, next_hidden_at FROM series_entry WHERE user_id = ? AND next_hidden_at IS NOT NULL',
      this.scope.userId(),
    );
    return new Map(rows.map((row) => [Number(row.series_id), String(row.next_hidden_at)]));
  }

  async setNextHidden(seriesId: number, at: string | null): Promise<boolean> {
    const meta = await execute(
      this.db,
      'UPDATE series_entry SET next_hidden_at = ? WHERE user_id = ? AND series_id = ?',
      at,
      this.scope.userId(),
      seriesId,
    );
    return meta.changes > 0;
  }
}
