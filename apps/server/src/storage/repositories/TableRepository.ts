import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

export type Row = Record<string, unknown>;
export type RowValues = Record<string, SQLInputValue>;

/**
 * Typed CRUD over one table. Subclasses map between entities and rows;
 * `update` merges a patch over the stored entity and rewrites the mapped columns.
 */
export abstract class TableRepository<T extends { id: number }> {
  constructor(
    protected readonly db: DatabaseSync,
    private readonly table: string,
  ) {}

  protected abstract toRow(entity: Omit<T, 'id'>): RowValues;
  protected abstract fromRow(row: Row): T;

  create(input: Omit<T, 'id'>): T {
    const values = this.toRow(input);
    const columns = Object.keys(values);
    const result = this.db
      .prepare(
        `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      )
      .run(...Object.values(values));
    return this.require(Number(result.lastInsertRowid));
  }

  get(id: number): T | undefined {
    const row = this.db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
    return row ? this.fromRow(row) : undefined;
  }

  list(): T[] {
    return this.db
      .prepare(`SELECT * FROM ${this.table} ORDER BY id`)
      .all()
      .map((row) => this.fromRow(row));
  }

  update(id: number, patch: Partial<Omit<T, 'id'>>): T {
    const current = Object.fromEntries(
      Object.entries(this.require(id)).filter(([key]) => key !== 'id'),
    );
    const values = this.toRow({ ...current, ...patch } as Omit<T, 'id'>);
    const assignments = Object.keys(values).map((column) => `${column} = ?`);
    this.db
      .prepare(`UPDATE ${this.table} SET ${assignments.join(', ')} WHERE id = ?`)
      .run(...Object.values(values), id);
    return this.require(id);
  }

  delete(id: number): boolean {
    return Number(this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id).changes) > 0;
  }

  protected require(id: number): T {
    const entity = this.get(id);
    if (!entity) throw new Error(`${this.table} ${id} not found`);
    return entity;
  }
}
