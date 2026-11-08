import type { CatalogCollection } from './CATALOG_COLLECTIONS.js';

/** A catalog item added by hand that no user has an entry for any more. */
export interface UnreferencedCatalogItem {
  collection: CatalogCollection;
  id: number;
  title: string;
  ownerId: number;
}
