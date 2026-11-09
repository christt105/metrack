import type { UserScope } from '../../users/UserScope.js';
import type { EntityRepository } from '../repositories/EntityRepository.js';
import type { PlainTableSpec } from '../mapping/PlainTableSpec.js';
import type { SqlValue } from '../mapping/SqlValue.js';
import { insertSql } from '../mapping/mediaTableSql.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll } from './d1Query.js';

/**
 * Typed CRUD over one D1 table of personal rows: every query only sees the rows of the user in scope, and
 * new rows belong to that user. Its `PlainTableSpec` maps between entities and rows; `update` merges a
 * patch over the stored entity and rewrites the mapped columns.
 */
export class D1PlainTableRepository<T extends { id: number }> implements EntityRepository<T> {
  private readonly table: string;

  constructor(
    protected readonly db: D1Database,
    protected readonly scope: UserScope,
    private readonly spec: PlainTableSpec<T>,
  ) {
    this.table = spec.table;
  }

  async create(input: Omit<T, 'id'>): Promise<T> {
    const values = { user_id: this.scope.userId(), ...this.spec.toRow(input) };
    const meta = await execute(
      this.db,
      insertSql(this.table, Object.keys(values)),
      ...Object.values(values),
    );
    return this.require(meta.last_row_id);
  }

  async get(id: number): Promise<T | undefined> {
    return this.find(id);
  }

  /** Reads the user's whole library; cache it (nr8fn1). */
  async list(): Promise<T[]> {
    return this.all('1 = 1 ORDER BY id');
  }

  async update(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const current = Object.fromEntries(
      Object.entries(await this.require(id)).filter(([key]) => key !== 'id'),
    );
    const values = this.spec.toRow({ ...current, ...patch } as Omit<T, 'id'>);
    const assignments = Object.keys(values).map((column) => `${column} = ?`);
    await execute(
      this.db,
      `UPDATE ${this.table} SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
      ...Object.values(values),
      id,
      this.scope.userId(),
    );
    return this.require(id);
  }

  async delete(id: number): Promise<boolean> {
    const meta = await execute(
      this.db,
      `DELETE FROM ${this.table} WHERE id = ? AND user_id = ?`,
      id,
      this.scope.userId(),
    );
    return meta.changes > 0;
  }

  /** The user's entities matching a trusted condition, which may end with an `ORDER BY` or `LIMIT`. */
  protected async all(condition: string, ...params: SqlValue[]): Promise<T[]> {
    const rows = await queryAll(
      this.db,
      `SELECT * FROM ${this.table} WHERE user_id = ? AND ${condition}`,
      this.scope.userId(),
      ...params,
    );
    return rows.map((row) => this.spec.fromRow(row));
  }

  private async find(id: number): Promise<T | undefined> {
    return (await this.all('id = ?', id))[0];
  }

  private async require(id: number): Promise<T> {
    const entity = await this.find(id);
    if (!entity) throw new Error(`${this.table} ${id} not found`);
    return entity;
  }
}
