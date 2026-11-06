/** Asynchronous CRUD over one kind of entity. `update` merges a patch over the stored entity. */
export interface EntityRepository<T extends { id: number }> {
  create(input: Omit<T, 'id'>): Promise<T>;
  get(id: number): Promise<T | undefined>;
  list(): Promise<T[]>;
  update(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  delete(id: number): Promise<boolean>;
}
