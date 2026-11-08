import type { CatalogCollection, UnreferencedCatalogItem } from '@metrack/domain';
import { HAND_ADDED_TABLES, unreferencedSql } from '../mapping/handAddedSql.js';
import type { HandAddedCatalogRepository } from '../repositories/HandAddedCatalogRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll, queryFirst } from './d1Query.js';

export class D1HandAddedCatalogRepository implements HandAddedCatalogRepository {
  constructor(private readonly db: D1Database) {}

  /** Scans the owned rows of every catalog table, which have no owner index; for admin tools, not per request. */
  async listUnreferenced(ownerId?: number): Promise<UnreferencedCatalogItem[]> {
    const items: UnreferencedCatalogItem[] = [];
    for (const [collection, table] of Object.entries(HAND_ADDED_TABLES) as [
      CatalogCollection,
      string,
    ][]) {
      const rows = await queryAll(
        this.db,
        `SELECT id, title, owner_id FROM ${table}
           WHERE owner_id IS NOT NULL AND (? IS NULL OR owner_id = ?) AND ${unreferencedSql(table)}
           ORDER BY id`,
        ownerId ?? null,
        ownerId ?? null,
      );
      for (const row of rows) {
        items.push({
          collection,
          id: Number(row.id),
          title: String(row.title),
          ownerId: Number(row.owner_id),
        });
      }
    }
    return items;
  }

  async find(
    collection: CatalogCollection,
    id: number,
  ): Promise<{ ownerId: number; referenced: boolean } | undefined> {
    const table = HAND_ADDED_TABLES[collection];
    const row = await queryFirst(
      this.db,
      `SELECT owner_id, NOT (${unreferencedSql(table)}) AS referenced FROM ${table}
         WHERE id = ? AND owner_id IS NOT NULL`,
      id,
    );
    return row
      ? { ownerId: Number(row.owner_id), referenced: Number(row.referenced) === 1 }
      : undefined;
  }

  async delete(collection: CatalogCollection, id: number): Promise<void> {
    await execute(this.db, `DELETE FROM ${HAND_ADDED_TABLES[collection]} WHERE id = ?`, id);
  }
}
