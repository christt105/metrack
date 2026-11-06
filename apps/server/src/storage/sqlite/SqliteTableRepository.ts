import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { EntityRepository } from '../repositories/EntityRepository.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';

/**
 * Typed CRUD over one media type stored as a catalog row (`<table>`) plus a personal entry
 * (`<table>_entry`, keyed by `<table>_id`). Subclasses map the whole entity to and from the joined
 * columns; `entryColumns` says which of them live in the entry. Hand edits of catalog fields are kept
 * in the entry's `overrides` and win over the catalog when reading. `update` writes a field to its
 * override when there is one, and to the catalog or the entry otherwise.
 */
export abstract class SqliteTableRepository<
  T extends { id: number },
> implements EntityRepository<T> {
  private readonly entryTable: string;
  private readonly key: string;
  private readonly entryColumns: ReadonlySet<string>;

  constructor(
    protected readonly db: DatabaseSync,
    private readonly table: string,
    entryColumns: readonly string[],
  ) {
    this.entryTable = `${table}_entry`;
    this.key = `${table}_id`;
    this.entryColumns = new Set(entryColumns);
  }

  protected abstract toRow(entity: Omit<T, 'id'>): RowValues;
  protected abstract fromRow(row: Row): T;

  async create(input: Omit<T, 'id'>): Promise<T> {
    const { catalog, entry } = this.split(this.toRow(input));
    const id = this.atomically(() => {
      const columns = Object.keys(catalog);
      const result = this.db
        .prepare(
          `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        )
        .run(...Object.values(catalog));
      const created = Number(result.lastInsertRowid);
      const entryColumns = [this.key, ...Object.keys(entry)];
      this.db
        .prepare(
          `INSERT INTO ${this.entryTable} (${entryColumns.join(', ')}) VALUES (${entryColumns.map(() => '?').join(', ')})`,
        )
        .run(created, ...Object.values(entry));
      return created;
    });
    return this.require(id);
  }

  async get(id: number): Promise<T | undefined> {
    return this.find(id);
  }

  async list(): Promise<T[]> {
    return this.where('1 = 1 ORDER BY c.id');
  }

  async update(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const { base, overrides } = this.requireStored(id);
    const rest: Record<string, unknown> = {};
    const nextOverrides = { ...overrides };
    for (const [field, value] of Object.entries(patch)) {
      if (field in overrides) nextOverrides[field] = value;
      else rest[field] = value;
    }
    this.write(id, { ...withoutId(base), ...rest } as Omit<T, 'id'>, nextOverrides);
    return this.require(id);
  }

  async override(id: number, fields: Partial<Omit<T, 'id'>>): Promise<T> {
    const { base, overrides } = this.requireStored(id);
    this.write(id, withoutId(base) as Omit<T, 'id'>, { ...overrides, ...fields });
    return this.require(id);
  }

  async clearOverride(id: number, field: string): Promise<T> {
    const { base, overrides } = this.requireStored(id);
    const next = { ...overrides };
    delete next[field];
    this.write(id, withoutId(base) as Omit<T, 'id'>, next);
    return this.require(id);
  }

  async overriddenFields(id: number): Promise<string[]> {
    return Object.keys(this.requireStored(id).overrides);
  }

  async delete(id: number): Promise<boolean> {
    return this.atomically(() => {
      this.db.prepare(`DELETE FROM ${this.entryTable} WHERE ${this.key} = ?`).run(id);
      return Number(this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id).changes) > 0;
    });
  }

  /** First entity whose column equals the value. The column name must be a trusted constant. */
  protected findOneBy(column: string, value: SQLInputValue): T | undefined {
    return this.where(`${this.qualify(column)} = ? ORDER BY c.id LIMIT 1`, value)[0];
  }

  /**
   * Entities matching a trusted condition over the catalog row `c` and the entry `e`, which may end
   * with an `ORDER BY` or `LIMIT`.
   */
  protected where(condition: string, ...params: SQLInputValue[]): T[] {
    return this.db
      .prepare(`${this.select()} WHERE ${condition}`)
      .all(...params)
      .map((row) => this.merge(row));
  }

  private select(): string {
    const entry = [...this.entryColumns].map((column) => `e.${column}`).join(', ');
    return `SELECT c.*, ${entry}, e.overrides AS overrides FROM ${this.table} c JOIN ${this.entryTable} e ON e.${this.key} = c.id`;
  }

  private qualify(column: string): string {
    return `${this.entryColumns.has(column) ? 'e' : 'c'}.${column}`;
  }

  private merge(row: Row): T {
    return { ...this.fromRow(row), ...parseOverrides(row.overrides) };
  }

  private find(id: number): T | undefined {
    return this.where('c.id = ?', id)[0];
  }

  private require(id: number): T {
    const entity = this.find(id);
    if (!entity) throw new Error(`${this.table} ${id} not found`);
    return entity;
  }

  private requireStored(id: number): { base: T; overrides: Record<string, unknown> } {
    const row = this.db.prepare(`${this.select()} WHERE c.id = ?`).get(id);
    if (!row) throw new Error(`${this.table} ${id} not found`);
    return { base: this.fromRow(row), overrides: parseOverrides(row.overrides) };
  }

  private write(id: number, base: Omit<T, 'id'>, overrides: Record<string, unknown>): void {
    const { catalog, entry } = this.split(this.toRow(base));
    this.atomically(() => {
      this.db
        .prepare(`UPDATE ${this.table} SET ${assignments(catalog)} WHERE id = ?`)
        .run(...Object.values(catalog), id);
      this.db
        .prepare(
          `UPDATE ${this.entryTable} SET ${assignments(entry)}, overrides = ? WHERE ${this.key} = ?`,
        )
        .run(...Object.values(entry), JSON.stringify(overrides), id);
    });
  }

  private split(values: RowValues): { catalog: RowValues; entry: RowValues } {
    const catalog: RowValues = {};
    const entry: RowValues = {};
    for (const [column, value] of Object.entries(values)) {
      (this.entryColumns.has(column) ? entry : catalog)[column] = value;
    }
    return { catalog, entry };
  }

  private atomically<R>(work: () => R): R {
    const savepoint = `write_${this.table}`;
    this.db.exec(`SAVEPOINT ${savepoint}`);
    try {
      const result = work();
      this.db.exec(`RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      this.db.exec(`ROLLBACK TO ${savepoint}`);
      this.db.exec(`RELEASE ${savepoint}`);
      throw error;
    }
  }
}

function assignments(values: RowValues): string {
  return Object.keys(values)
    .map((column) => `${column} = ?`)
    .join(', ');
}

function withoutId<T extends { id: number }>(entity: T): Omit<T, 'id'> {
  const rest: Partial<T> = { ...entity };
  delete rest.id;
  return rest as Omit<T, 'id'>;
}

function parseOverrides(value: unknown): Record<string, unknown> {
  return JSON.parse(String(value)) as Record<string, unknown>;
}
