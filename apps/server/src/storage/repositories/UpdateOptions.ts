/** How an `update` treats catalog columns other users also hold. */
export interface UpdateOptions {
  /** Writes catalog columns even when other users have the row, changing them for all of them. Never the default. */
  allowSharedCatalog?: boolean;
}
