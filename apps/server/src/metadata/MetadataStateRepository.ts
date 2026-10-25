import type { DatabaseSync } from 'node:sqlite';
import type { MediaType } from '@metrack/domain';
import type { MetadataState } from './MetadataState.js';

const TABLES: Record<MediaType, string> = {
  movie: 'movie',
  series: 'series',
  season: 'season',
  videogame: 'videogame',
  book: 'book',
};

/** Reads and writes the cache bookkeeping columns (`fetched_at`, `metadata_hash`, `edited_fields`). */
export class MetadataStateRepository {
  constructor(private readonly db: DatabaseSync) {}

  get(type: MediaType, id: number): MetadataState {
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

  /** Records a refresh. Pass `metadataHash` only when the content changed. */
  markFetched(type: MediaType, id: number, fetchedAt: string, metadataHash?: string): void {
    if (metadataHash === undefined) {
      this.db.prepare(`UPDATE ${TABLES[type]} SET fetched_at = ? WHERE id = ?`).run(fetchedAt, id);
      return;
    }
    this.db
      .prepare(`UPDATE ${TABLES[type]} SET fetched_at = ?, metadata_hash = ? WHERE id = ?`)
      .run(fetchedAt, metadataHash, id);
  }

  /** Protects a field from being overwritten by provider data. */
  markEdited(type: MediaType, id: number, field: string): void {
    const { editedFields } = this.get(type, id);
    if (editedFields.includes(field)) return;
    this.setEdited(type, id, [...editedFields, field]);
  }

  unmarkEdited(type: MediaType, id: number, field: string): void {
    const { editedFields } = this.get(type, id);
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
