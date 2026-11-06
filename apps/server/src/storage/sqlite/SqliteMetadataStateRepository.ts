import type { DatabaseSync } from 'node:sqlite';
import type { MediaType } from '@metrack/domain';
import type { MetadataState } from '../../metadata/MetadataState.js';
import type { MetadataStateRepository } from '../repositories/MetadataStateRepository.js';

const TABLES: Record<MediaType, string> = {
  movie: 'movie',
  series: 'series',
  season: 'season',
  videogame: 'videogame',
  book: 'book',
};

export class SqliteMetadataStateRepository implements MetadataStateRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(type: MediaType, id: number): Promise<MetadataState> {
    const row = this.db
      .prepare(`SELECT fetched_at, metadata_hash, edited_fields FROM ${TABLES[type]} WHERE id = ?`)
      .get(id);
    if (!row) throw new Error(`${type} ${id} not found`);
    return {
      fetchedAt: row.fetched_at === null ? null : String(row.fetched_at),
      metadataHash: row.metadata_hash === null ? null : String(row.metadata_hash),
      editedFields: JSON.parse(String(row.edited_fields)) as string[],
    };
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

  async markEdited(type: MediaType, id: number, field: string): Promise<void> {
    const { editedFields } = await this.get(type, id);
    if (editedFields.includes(field)) return;
    this.setEdited(type, id, [...editedFields, field]);
  }

  async unmarkEdited(type: MediaType, id: number, field: string): Promise<void> {
    const { editedFields } = await this.get(type, id);
    this.setEdited(
      type,
      id,
      editedFields.filter((f) => f !== field),
    );
  }

  private setEdited(type: MediaType, id: number, fields: string[]): void {
    this.db
      .prepare(`UPDATE ${TABLES[type]} SET edited_fields = ? WHERE id = ?`)
      .run(JSON.stringify(fields), id);
  }
}
