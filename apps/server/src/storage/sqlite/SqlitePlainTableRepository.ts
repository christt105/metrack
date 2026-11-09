import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { EntityRepository } from '../repositories/EntityRepository.js';
import type { PlainTableSpec } from '../mapping/PlainTableSpec.js';

/**
 * Typed CRUD over one SQLite table of personal rows: every query only sees the rows of the user in scope,
 * and new rows belong to that user. Its `PlainTableSpec` maps between entities and rows; `update` merges a patch over
 * the stored entity and rewrites the mapped columns.
 */
export class SqlitePlainTableRepository<T extends { id: number }> implements EntityRepository<T> {
  private readonly table: string;

  constructor(
    protected readonly db: DatabaseSync,
    protected readonly scope: UserScope,
    private readonly spec: PlainTableSpec<T>,
  ) {
    this.table = spec.table;
  }

  async create(input: Omit<T, 'id'>): Promise<T> {
    const values = { user_id: this.scope.userId(), ...this.spec.toRow(input) };
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
    return this.all('1 = 1 ORDER BY id');
  }

  async update(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const current = Object.fromEntries(
      Object.entries(this.require(id)).filter(([key]) => key !== 'id'),
    );
    const values = this.spec.toRow({ ...current, ...patch } as Omit<T, 'id'>);
    const assignments = Object.keys(values).map((column) => `${column} = ?`);
    this.db
      .prepare(`UPDATE ${this.table} SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...Object.values(values), id, this.scope.userId());
    return this.require(id);
  }

  async delete(id: number): Promise<boolean> {
    return (
      Number(
        this.db
          .prepare(`DELETE FROM ${this.table} WHERE id = ? AND user_id = ?`)
          .run(id, this.scope.userId()).changes,
      ) > 0
    );
  }

  /** The user's first entity whose column equals the value. The column name must be a trusted constant. */
  protected findOneBy(column: string, value: SQLInputValue): T | undefined {
    return this.all(`${column} = ? ORDER BY id LIMIT 1`, value)[0];
  }

  /** The user's entities matching a trusted condition, which may end with an `ORDER BY` or `LIMIT`. */
  protected all(condition: string, ...params: SQLInputValue[]): T[] {
    return this.db
      .prepare(`SELECT * FROM ${this.table} WHERE user_id = ? AND ${condition}`)
      .all(this.scope.userId(), ...params)
      .map((row) => this.spec.fromRow(row));
  }

  private find(id: number): T | undefined {
    return this.all('id = ?', id)[0];
  }

  private require(id: number): T {
    const entity = this.find(id);
    if (!entity) throw new Error(`${this.table} ${id} not found`);
    return entity;
  }
}
