import type { CatalogCollection, UnreferencedCatalogItem } from '@metrack/domain';

/** Catalog rows added by hand (no provider id), which belong to a user instead of being shared. Not user-scoped. */
export interface HandAddedCatalogRepository {
  /** The hand-added items nobody has an entry for, optionally only those of one owner. */
  listUnreferenced(ownerId?: number): Promise<UnreferencedCatalogItem[]>;
  /** The row's owner and whether any user has an entry for it; undefined when there is no such hand-added row. */
  find(
    collection: CatalogCollection,
    id: number,
  ): Promise<{ ownerId: number; referenced: boolean } | undefined>;
  /** Deletes the row (and its seasons, for a series). */
  delete(collection: CatalogCollection, id: number): Promise<void>;
}
