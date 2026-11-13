import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { MediaType } from '@metrack/domain';
import type { MetadataState } from '../../metadata/MetadataState.js';
import type { CatalogType } from '../repositories/CatalogType.js';
import type { MetadataStateRepository } from '../repositories/MetadataStateRepository.js';

const TABLES: Record<MediaType, string> = {
  movie: 'movie',
  series: 'series',
  season: 'season',
  videogame: 'videogame',
  book: 'book',
};

export class SqliteMetadataStateRepository implements MetadataStateRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly scope: UserScope,
  ) {}

  async get(type: MediaType, id: number): Promise<MetadataState> {
    const row = this.db
      .prepare(
        `SELECT c.fetched_at, c.metadata_hash, e.overrides FROM ${TABLES[type]} c
         JOIN ${TABLES[type]}_entry e ON e.${TABLES[type]}_id = c.id AND e.user_id = ? WHERE c.id = ?`,
      )
      .get(this.scope.userId(), id);
    if (!row) throw new Error(`${type} ${id} not found`);
    return {
      fetchedAt: row.fetched_at === null ? null : String(row.fetched_at),
      metadataHash: row.metadata_hash === null ? null : String(row.metadata_hash),
      editedFields: Object.keys(JSON.parse(String(row.overrides)) as Record<string, unknown>),
    };
  }

  async unfetched(type: CatalogType): Promise<number[]> {
    return this.db
      .prepare(
        `SELECT c.id FROM ${type} c JOIN ${type}_entry e ON e.${type}_id = c.id AND e.user_id = ?
         WHERE c.fetched_at IS NULL AND c.tmdb_id IS NOT NULL ORDER BY c.id`,
      )
      .all(this.scope.userId())
      .map((row) => Number(row.id));
  }

  async markFetched(
    type: MediaType,
    id: number,
    fetchedAt: string,
    metadataHash?: string,
  ): Promise<void> {
    if (metadataHash === undefined) {
      this.db.prepare(`UPDATE ${TABLES[type]} SET fetched_at = ? WHERE id = ?`).run(fetchedAt, id);
      return;
    }
    this.db
      .prepare(`UPDATE ${TABLES[type]} SET fetched_at = ?, metadata_hash = ? WHERE id = ?`)
      .run(fetchedAt, metadataHash, id);
  }
}
