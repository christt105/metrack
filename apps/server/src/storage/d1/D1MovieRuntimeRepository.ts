import { SELECT_MISSING_RUNTIME_SQL, SET_RUNTIME_SQL } from '../mapping/movieRuntimeSql.js';
import type { MissingRuntime } from '../repositories/MissingRuntime.js';
import type { MovieRuntimeRepository } from '../repositories/MovieRuntimeRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll } from './d1Query.js';

export class D1MovieRuntimeRepository implements MovieRuntimeRepository {
  constructor(private readonly db: D1Database) {}

  async listMissing(limit: number): Promise<MissingRuntime[]> {
    const rows = await queryAll(this.db, SELECT_MISSING_RUNTIME_SQL, limit);
    return rows.map((row) => ({ id: Number(row.id), tmdbId: Number(row.tmdb_id) }));
  }

  async set(id: number, minutes: number): Promise<void> {
    await execute(this.db, SET_RUNTIME_SQL, minutes, id);
  }
}
