import type { MediaType } from '@metrack/domain';
import type { MetadataState } from '../../metadata/MetadataState.js';
import type { UserScope } from '../../users/UserScope.js';
import type { MetadataStateRepository } from '../repositories/MetadataStateRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryFirst } from './d1Query.js';

const TABLES: Record<MediaType, string> = {
  movie: 'movie',
  series: 'series',
  season: 'season',
  videogame: 'videogame',
  book: 'book',
};

export class D1MetadataStateRepository implements MetadataStateRepository {
  constructor(
    private readonly db: D1Database,
    private readonly scope: UserScope,
  ) {}

  async get(type: MediaType, id: number): Promise<MetadataState> {
    const row = await queryFirst(
      this.db,
      `SELECT c.fetched_at, c.metadata_hash, e.overrides FROM ${TABLES[type]} c
         JOIN ${TABLES[type]}_entry e ON e.${TABLES[type]}_id = c.id AND e.user_id = ? WHERE c.id = ?`,
      this.scope.userId(),
      id,
    );
    if (!row) throw new Error(`${type} ${id} not found`);
    return {
      fetchedAt: row.fetched_at === null ? null : String(row.fetched_at),
      metadataHash: row.metadata_hash === null ? null : String(row.metadata_hash),
      editedFields: Object.keys(JSON.parse(String(row.overrides)) as Record<string, unknown>),
    };
  }

  async markFetched(
    type: MediaType,
    id: number,
    fetchedAt: string,
    metadataHash?: string,
  ): Promise<void> {
    if (metadataHash === undefined) {
      await execute(
        this.db,
        `UPDATE ${TABLES[type]} SET fetched_at = ? WHERE id = ?`,
        fetchedAt,
        id,
      );
      return;
    }
    await execute(
      this.db,
      `UPDATE ${TABLES[type]} SET fetched_at = ?, metadata_hash = ? WHERE id = ?`,
      fetchedAt,
      metadataHash,
      id,
    );
  }
}
