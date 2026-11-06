import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { EntityRepository } from '../repositories/EntityRepository.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';

/**
 * Typed CRUD over one SQLite table. Subclasses map between entities and rows;
 * `update` merges a patch over the stored entity and rewrites the mapped columns.
 */
export abstract class SqliteTableRepository<
  T extends { id: number },
> implements EntityRepository<T> {
  constructor(
    protected readonly db: DatabaseSync,
    private readonly table: string,
  ) {}

  protected abstract toRow(entity: Omit<T, 'id'>): RowValues;
  protected abstract fromRow(row: Row): T;

  async create(input: Omit<T, 'id'>): Promise<T> {
    const values = this.toRow(input);
    const columns = Object.keys(values);
    const result = this.db
      .prepare(
        `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      )
      .run(...Object.values(values));
    return this.require(Number(result.lastInsertRowid));
  }

  async get(id: number): Promise<T | undefined> {
    return this.find(id);
  }

  async list(): Promise<T[]> {
    return this.all(`SELECT * FROM ${this.table} ORDER BY id`);
  }

  async update(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T> {
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

  async delete(id: number): Promise<boolean> {
    return Number(this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id).changes) > 0;
  }

  /** First entity whose column equals the value. The column name must be a trusted constant. */
  protected findOneBy(column: string, value: SQLInputValue): T | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.table} WHERE ${column} = ? ORDER BY id LIMIT 1`)
      .get(value);
    return row ? this.fromRow(row) : undefined;
  }

  /** Every entity a trusted query returns. */
  protected all(sql: string, ...params: SQLInputValue[]): T[] {
    return this.db
      .prepare(sql)
      .all(...params)
      .map((row) => this.fromRow(row));
  }

  private find(id: number): T | undefined {
    const row = this.db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
    return row ? this.fromRow(row) : undefined;
  }

  private require(id: number): T {
    const entity = this.find(id);
    if (!entity) throw new Error(`${this.table} ${id} not found`);
    return entity;
  }
}
