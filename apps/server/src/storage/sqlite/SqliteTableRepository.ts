import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { MediaEntityRepository } from '../repositories/MediaEntityRepository.js';
import { SharedCatalogError } from '../SharedCatalogError.js';
import type { MediaTableSpec } from '../mapping/MediaTableSpec.js';
import type { Row } from '../mapping/Row.js';
import type { RowValues } from '../mapping/RowValues.js';
import {
  findCatalogSql,
  insertSql,
  MAX_IDS_PER_QUERY,
  placeholders,
  qualifyColumn,
  selectMedia,
} from '../mapping/mediaTableSql.js';
import {
  assignments,
  changedColumns,
  ownedCatalog,
  parseOverrides,
  releasedCatalog,
  splitRow,
  withoutId,
} from '../mapping/tableRows.js';

/**
 * Typed CRUD over one media type stored as a shared catalog row plus one personal entry per user, as
 * described by its `MediaTableSpec`. Every query joins only the entry of the user in scope, so adding a title
 * that is already in the catalog reuses its row. Hand edits of catalog fields are kept in the entry's
 * `overrides` and win over the catalog when reading.
 */
export class SqliteTableRepository<T extends { id: number }> implements MediaEntityRepository<T> {
  private readonly table: string;
  protected readonly entryTable: string;
  protected readonly key: string;
  private readonly entryColumns: ReadonlySet<string>;

  constructor(
    protected readonly db: DatabaseSync,
    protected readonly scope: UserScope,
    private readonly spec: MediaTableSpec<T>,
  ) {
    this.table = spec.table;
    this.entryTable = `${spec.table}_entry`;
    this.key = `${spec.table}_id`;
    this.entryColumns = new Set(spec.entryColumns);
  }

  async create(input: Omit<T, 'id'>): Promise<T> {
    const { catalog, entry } = this.split(this.spec.toRow(input));
    const userId = this.scope.userId();
    const id = this.atomically(() => {
      const catalogId =
        this.findCatalogRow(catalog) ??
        this.insertCatalogRow(ownedCatalog(this.spec, catalog, userId));
      const entryColumns = ['user_id', this.key, ...Object.keys(entry)];
      this.db
        .prepare(insertSql(this.entryTable, entryColumns))
        .run(userId, catalogId, ...Object.values(entry));
      return catalogId;
    });
    return this.require(id);
  }

  async get(id: number): Promise<T | undefined> {
    return this.find(id);
  }

  async getMany(ids: readonly number[]): Promise<T[]> {
    const found: T[] = [];
    for (let start = 0; start < ids.length; start += MAX_IDS_PER_QUERY) {
      const chunk = ids.slice(start, start + MAX_IDS_PER_QUERY);
      found.push(...this.where(`c.id IN (${placeholders(chunk.length)})`, ...chunk));
    }
    return found.sort((a, b) => a.id - b.id);
  }

  async list(): Promise<T[]> {
    return this.where('1 = 1 ORDER BY c.id');
  }

  async update(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const { base, overrides, row } = this.requireStored(id);
    const rest: Record<string, unknown> = {};
    const nextOverrides = { ...overrides };
    for (const [field, value] of Object.entries(patch)) {
      if (field in overrides) nextOverrides[field] = value;
      else rest[field] = value;
    }
    const next = this.split(this.spec.toRow({ ...withoutId(base), ...rest } as Omit<T, 'id'>));
    const changed = changedColumns(row, next.catalog);
    if (changed.length > 0 && this.sharedWithOthers(id)) {
      throw new SharedCatalogError(this.table, changed);
    }
    this.write(id, next, nextOverrides);
    return this.require(id);
  }

  async updateCatalog(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const { base, overrides } = this.requireStored(id);
    const before = this.split(this.spec.toRow(withoutId(base) as Omit<T, 'id'>));
    const after = this.split(this.spec.toRow({ ...withoutId(base), ...patch } as Omit<T, 'id'>));
    const personal = changedColumns(before.entry, after.entry);
    if (personal.length > 0) throw new Error(`Not catalog columns: ${personal.join(', ')}`);
    this.write(id, { catalog: after.catalog, entry: before.entry }, overrides);
    return this.require(id);
  }

  async override(id: number, fields: Partial<Omit<T, 'id'>>): Promise<T> {
    const { base, overrides } = this.requireStored(id);
    this.write(id, this.split(this.spec.toRow(withoutId(base) as Omit<T, 'id'>)), {
      ...overrides,
      ...fields,
    });
    return this.require(id);
  }

  async clearOverride(id: number, field: string): Promise<T> {
    const { base, overrides } = this.requireStored(id);
    const next = { ...overrides };
    delete next[field];
    this.write(id, this.split(this.spec.toRow(withoutId(base) as Omit<T, 'id'>)), next);
    return this.require(id);
  }

  async overriddenFields(id: number): Promise<string[]> {
    return Object.keys(this.requireStored(id).overrides);
  }

  async delete(id: number): Promise<boolean> {
    const userId = this.scope.userId();
    return this.atomically(() => {
      const removed = Number(
        this.db
          .prepare(`DELETE FROM ${this.entryTable} WHERE user_id = ? AND ${this.key} = ?`)
          .run(userId, id).changes,
      );
      if (removed === 0) return false;
      for (const sql of this.spec.relatedDeletes) this.db.prepare(sql).run(userId, id);
      const left = this.db
        .prepare(`SELECT 1 FROM ${this.entryTable} WHERE ${this.key} = ? LIMIT 1`)
        .get(id);
      if (!left) this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id);
      return true;
    });
  }

  /** First entity whose column equals the value. The column name must be a trusted constant. */
  protected findOneBy(column: string, value: SQLInputValue): T | undefined {
    return this.where(`${qualifyColumn(this.spec, column)} = ? ORDER BY c.id LIMIT 1`, value)[0];
  }

  /**
   * The user's entities matching a trusted condition over the catalog row `c` and the entry `e`, which may
   * end with an `ORDER BY` or `LIMIT`.
   */
  protected where(condition: string, ...params: SQLInputValue[]): T[] {
    return this.db
      .prepare(`${selectMedia(this.spec)} WHERE ${condition}`)
      .all(this.scope.userId(), ...params)
      .map((row) => this.merge(row));
  }

  private merge(row: Row): T {
    return { ...this.spec.fromRow(row), ...parseOverrides(row.overrides) };
  }

  private find(id: number): T | undefined {
    return this.where('c.id = ?', id)[0];
  }

  private require(id: number): T {
    const entity = this.find(id);
    if (!entity) throw new Error(`${this.table} ${id} not found`);
    return entity;
  }

  private requireStored(id: number): { base: T; overrides: Record<string, unknown>; row: Row } {
    const row = this.db
      .prepare(`${selectMedia(this.spec)} WHERE c.id = ?`)
      .get(this.scope.userId(), id);
    if (!row) throw new Error(`${this.table} ${id} not found`);
    return { base: this.spec.fromRow(row), overrides: parseOverrides(row.overrides), row };
  }

  private sharedWithOthers(id: number): boolean {
    return (
      this.db
        .prepare(`SELECT 1 FROM ${this.entryTable} WHERE ${this.key} = ? AND user_id <> ? LIMIT 1`)
        .get(id, this.scope.userId()) !== undefined
    );
  }

  private findCatalogRow(catalog: RowValues): number | undefined {
    for (const columns of this.spec.catalogKeys) {
      const values = columns.map((column) => catalog[column]);
      if (values.some((value) => value === null || value === undefined)) continue;
      const row = this.db
        .prepare(findCatalogSql(this.spec, columns))
        .get(...(values as SQLInputValue[]));
      if (row) return Number(row.id);
    }
    return undefined;
  }

  private insertCatalogRow(catalog: RowValues): number {
    const result = this.db
      .prepare(insertSql(this.table, Object.keys(catalog)))
      .run(...Object.values(catalog));
    return Number(result.lastInsertRowid);
  }

  private write(
    id: number,
    values: { catalog: RowValues; entry: RowValues },
    overrides: Record<string, unknown>,
  ): void {
    const userId = this.scope.userId();
    const catalog = releasedCatalog(this.spec, values.catalog);
    this.atomically(() => {
      this.db
        .prepare(`UPDATE ${this.table} SET ${assignments(catalog)} WHERE id = ?`)
        .run(...Object.values(catalog), id);
      this.db
        .prepare(
          `UPDATE ${this.entryTable} SET ${assignments(values.entry)}, overrides = ?
           WHERE user_id = ? AND ${this.key} = ?`,
        )
        .run(...Object.values(values.entry), JSON.stringify(overrides), userId, id);
    });
  }

  private split(values: RowValues): { catalog: RowValues; entry: RowValues } {
    return splitRow(this.entryColumns, values);
  }

  protected atomically<R>(work: () => R): R {
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
