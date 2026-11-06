/** A user tried to change a catalog field (an external id, a season number) of a title someone else also has. */
export class SharedCatalogError extends Error {
  constructor(
    readonly table: string,
    readonly fields: string[],
  ) {
    super(`Other users have this ${table} too, so ${fields.join(', ')} cannot change`);
    this.name = 'SharedCatalogError';
  }
}
