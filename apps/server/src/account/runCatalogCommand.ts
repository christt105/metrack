import { join } from 'node:path';
import { CATALOG_COLLECTIONS, type CatalogCollection } from '@metrack/domain';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import { SqliteHandAddedCatalogRepository } from '../storage/sqlite/SqliteHandAddedCatalogRepository.js';

export interface CatalogCommand {
  dataDir: string;
  /** Deletes this item instead of listing; it must be a hand-added item no user has an entry for. */
  delete?: { collection: string; id: number };
}

/** Runs `metrack catalog` (lists the unreferenced hand-added items) and `metrack catalog delete <collection> <id>`. */
export async function runCatalogCommand(command: CatalogCommand): Promise<string> {
  const db = openDatabase(join(command.dataDir, 'metrack.db'));
  try {
    new MigrationRunner(db, migrations).run();
    const catalog = new SqliteHandAddedCatalogRepository(db);
    if (command.delete) {
      const { collection, id } = command.delete;
      if (!CATALOG_COLLECTIONS.includes(collection as CatalogCollection)) {
        throw new Error(`Collection must be one of ${CATALOG_COLLECTIONS.join(', ')}`);
      }
      const row = await catalog.find(collection as CatalogCollection, id);
      if (!row) throw new Error(`There is no hand-added ${collection} item ${id}`);
      if (row.referenced) throw new Error(`Some user still has ${collection} item ${id}`);
      await catalog.delete(collection as CatalogCollection, id);
      return `Deleted ${collection} item ${id}`;
    }
    const items = await catalog.listUnreferenced();
    if (items.length === 0) return 'No hand-added item is unreferenced';
    return items
      .map((item) => `${item.collection}  ${item.id}  ${item.title}  (owner ${item.ownerId})`)
      .join('\n');
  } finally {
    db.close();
  }
}
