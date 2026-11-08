/** The collections that have catalog rows added by hand, which belong to a user and can be unreferenced. */
export const CATALOG_COLLECTIONS = ['movies', 'series', 'games', 'books'] as const;

export type CatalogCollection = (typeof CATALOG_COLLECTIONS)[number];
