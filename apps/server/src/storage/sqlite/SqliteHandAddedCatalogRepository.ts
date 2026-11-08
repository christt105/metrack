import type { DatabaseSync } from 'node:sqlite';
import type { CatalogCollection, UnreferencedCatalogItem } from '@metrack/domain';
import type { HandAddedCatalogRepository } from '../repositories/HandAddedCatalogRepository.js';

const TABLES: Record<CatalogCollection, string> = {
  movies: 'movie',
  series: 'series',
  games: 'videogame',
  books: 'book',
};

export class SqliteHandAddedCatalogRepository implements HandAddedCatalogRepository {
  constructor(private readonly db: DatabaseSync) {}

  async listUnreferenced(ownerId?: number): Promise<UnreferencedCatalogItem[]> {
    const items: UnreferencedCatalogItem[] = [];
    for (const [collection, table] of Object.entries(TABLES) as [CatalogCollection, string][]) {
      const rows = this.db
        .prepare(
          `SELECT id, title, owner_id FROM ${table}
           WHERE owner_id IS NOT NULL AND (? IS NULL OR owner_id = ?) AND ${unreferenced(table)}
           ORDER BY id`,
        )
        .all(ownerId ?? null, ownerId ?? null);
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
    const table = TABLES[collection];
    const row = this.db
      .prepare(
        `SELECT owner_id, NOT (${unreferenced(table)}) AS referenced FROM ${table}
         WHERE id = ? AND owner_id IS NOT NULL`,
      )
      .get(id);
    return row
      ? { ownerId: Number(row.owner_id), referenced: Number(row.referenced) === 1 }
      : undefined;
  }

  async delete(collection: CatalogCollection, id: number): Promise<void> {
    this.db.prepare(`DELETE FROM ${TABLES[collection]} WHERE id = ?`).run(id);
  }
}

function unreferenced(table: string): string {
  const own = `NOT EXISTS (SELECT 1 FROM ${table}_entry WHERE ${table}_id = ${table}.id)`;
  if (table !== 'series') return own;
  return `${own} AND NOT EXISTS (
    SELECT 1 FROM season_entry WHERE season_id IN (SELECT id FROM season WHERE series_id = series.id)
  )`;
}
