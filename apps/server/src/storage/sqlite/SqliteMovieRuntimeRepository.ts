import type { DatabaseSync } from 'node:sqlite';
import { SELECT_MISSING_RUNTIME_SQL, SET_RUNTIME_SQL } from '../mapping/movieRuntimeSql.js';
import type { MissingRuntime } from '../repositories/MissingRuntime.js';
import type { MovieRuntimeRepository } from '../repositories/MovieRuntimeRepository.js';

export class SqliteMovieRuntimeRepository implements MovieRuntimeRepository {
  constructor(private readonly db: DatabaseSync) {}

  async listMissing(limit: number): Promise<MissingRuntime[]> {
    return this.db
      .prepare(SELECT_MISSING_RUNTIME_SQL)
      .all(limit)
      .map((row) => ({ id: Number(row.id), tmdbId: Number(row.tmdb_id) }));
  }

  async set(id: number, minutes: number): Promise<void> {
    this.db.prepare(SET_RUNTIME_SQL).run(minutes, id);
  }
}
