/** Tells which schema version the database is at. */
export interface SchemaVersionSource {
  currentVersion(): number | Promise<number>;
}
