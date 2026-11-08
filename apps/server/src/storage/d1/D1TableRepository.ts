import type { UserScope } from '../../users/UserScope.js';
import type { MediaEntityRepository } from '../repositories/MediaEntityRepository.js';
import { SharedCatalogError } from '../SharedCatalogError.js';
import type { MediaTableSpec } from '../mapping/MediaTableSpec.js';
import type { Row } from '../mapping/Row.js';
import type { RowValues } from '../mapping/RowValues.js';
import type { SqlValue } from '../mapping/SqlValue.js';
import { findCatalogSql, insertSql, qualifyColumn, selectMedia } from '../mapping/mediaTableSql.js';
import {
  assignments,
  changedColumns,
  ownedCatalog,
  parseOverrides,
  releasedCatalog,
  splitRow,
  withoutId,
} from '../mapping/tableRows.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll, queryFirst, statement } from './d1Query.js';

/**
 * Typed CRUD over one media type stored as a shared catalog row plus one personal entry per user, as
 * described by its `MediaTableSpec`, on D1. It follows `SqliteTableRepository` statement for statement;
 * writes that touch the catalog and the entry together go through `batch`, which D1 runs atomically.
 */
export class D1TableRepository<T extends { id: number }> implements MediaEntityRepository<T> {
  private readonly table: string;
  private readonly entryTable: string;
  private readonly key: string;
  private readonly entryColumns: ReadonlySet<string>;

  constructor(
    protected readonly db: D1Database,
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
    const entryColumns = Object.keys(entry);
    const existing = await this.findCatalogRow(catalog);
    let id: number;
    if (existing !== undefined) {
      await execute(
        this.db,
        insertSql(this.entryTable, ['user_id', this.key, ...entryColumns]),
        userId,
        existing,
        ...Object.values(entry),
      );
      id = existing;
    } else {
      const owned = ownedCatalog(this.spec, catalog, userId);
      const columns = ['user_id', this.key, ...entryColumns];
      const marks = ['?', 'last_insert_rowid()', ...entryColumns.map(() => '?')];
      const [inserted] = await this.db.batch([
        statement(this.db, insertSql(this.table, Object.keys(owned)), Object.values(owned)),
        statement(
          this.db,
          `INSERT INTO ${this.entryTable} (${columns.join(', ')}) VALUES (${marks.join(', ')})`,
          [userId, ...Object.values(entry)],
        ),
      ]);
      id = Number(inserted?.meta.last_row_id);
    }
    return this.require(id);
  }

  async get(id: number): Promise<T | undefined> {
    return this.find(id);
  }

  /** Reads the user's whole library; cache it (nr8fn1). */
  async list(): Promise<T[]> {
    return this.where('1 = 1 ORDER BY c.id');
  }

  async update(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const { base, overrides, row } = await this.requireStored(id);
    const rest: Record<string, unknown> = {};
    const nextOverrides = { ...overrides };
    for (const [field, value] of Object.entries(patch)) {
      if (field in overrides) nextOverrides[field] = value;
      else rest[field] = value;
    }
    const next = this.split(this.spec.toRow({ ...withoutId(base), ...rest } as Omit<T, 'id'>));
    const changed = changedColumns(row, next.catalog);
    if (changed.length > 0 && (await this.sharedWithOthers(id))) {
      throw new SharedCatalogError(this.table, changed);
    }
    await this.write(id, next, nextOverrides);
    return this.require(id);
  }

  async updateCatalog(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const { base, overrides } = await this.requireStored(id);
    const before = this.split(this.spec.toRow(withoutId(base) as Omit<T, 'id'>));
    const after = this.split(this.spec.toRow({ ...withoutId(base), ...patch } as Omit<T, 'id'>));
    const personal = changedColumns(before.entry, after.entry);
    if (personal.length > 0) throw new Error(`Not catalog columns: ${personal.join(', ')}`);
    await this.write(id, { catalog: after.catalog, entry: before.entry }, overrides);
    return this.require(id);
  }

  async override(id: number, fields: Partial<Omit<T, 'id'>>): Promise<T> {
    const { base, overrides } = await this.requireStored(id);
    await this.write(id, this.split(this.spec.toRow(withoutId(base) as Omit<T, 'id'>)), {
      ...overrides,
      ...fields,
    });
    return this.require(id);
  }

  async clearOverride(id: number, field: string): Promise<T> {
    const { base, overrides } = await this.requireStored(id);
    const next = { ...overrides };
    delete next[field];
    await this.write(id, this.split(this.spec.toRow(withoutId(base) as Omit<T, 'id'>)), next);
    return this.require(id);
  }

  async overriddenFields(id: number): Promise<string[]> {
    return Object.keys((await this.requireStored(id)).overrides);
  }

  async delete(id: number): Promise<boolean> {
    const userId = this.scope.userId();
    const held = await queryFirst(
      this.db,
      `SELECT 1 FROM ${this.entryTable} WHERE user_id = ? AND ${this.key} = ?`,
      userId,
      id,
    );
    if (!held) return false;
    await this.db.batch([
      statement(this.db, `DELETE FROM ${this.entryTable} WHERE user_id = ? AND ${this.key} = ?`, [
        userId,
        id,
      ]),
      ...this.spec.relatedDeletes.map((sql) => statement(this.db, sql, [userId, id])),
      statement(
        this.db,
        `DELETE FROM ${this.table} WHERE id = ?
           AND NOT EXISTS (SELECT 1 FROM ${this.entryTable} WHERE ${this.key} = ?)`,
        [id, id],
      ),
    ]);
    return true;
  }

  /** First entity whose column equals the value. The column name must be a trusted constant. */
  protected async findOneBy(column: string, value: SqlValue): Promise<T | undefined> {
    return (
      await this.where(`${qualifyColumn(this.spec, column)} = ? ORDER BY c.id LIMIT 1`, value)
    )[0];
  }

  /**
   * The user's entities matching a trusted condition over the catalog row `c` and the entry `e`, which may
   * end with an `ORDER BY` or `LIMIT`.
   */
  protected async where(condition: string, ...params: SqlValue[]): Promise<T[]> {
    const rows = await queryAll(
      this.db,
      `${selectMedia(this.spec)} WHERE ${condition}`,
      this.scope.userId(),
      ...params,
    );
    return rows.map((row) => this.merge(row));
  }

  private merge(row: Row): T {
    return { ...this.spec.fromRow(row), ...parseOverrides(row.overrides) };
  }

  private async find(id: number): Promise<T | undefined> {
    return (await this.where('c.id = ?', id))[0];
  }

  private async require(id: number): Promise<T> {
    const entity = await this.find(id);
    if (!entity) throw new Error(`${this.table} ${id} not found`);
    return entity;
  }

  private async requireStored(
    id: number,
  ): Promise<{ base: T; overrides: Record<string, unknown>; row: Row }> {
    const row = await queryFirst(
      this.db,
      `${selectMedia(this.spec)} WHERE c.id = ?`,
      this.scope.userId(),
      id,
    );
    if (!row) throw new Error(`${this.table} ${id} not found`);
    return {
      base: this.spec.fromRow(row),
      overrides: parseOverrides(row.overrides),
      row,
    };
  }

  private async sharedWithOthers(id: number): Promise<boolean> {
    return (
      (await queryFirst(
        this.db,
        `SELECT 1 FROM ${this.entryTable} WHERE ${this.key} = ? AND user_id <> ? LIMIT 1`,
        id,
        this.scope.userId(),
      )) !== undefined
    );
  }

  private async findCatalogRow(catalog: RowValues): Promise<number | undefined> {
    for (const columns of this.spec.catalogKeys) {
      const values = columns.map((column) => catalog[column]);
      if (values.some((value) => value === null || value === undefined)) continue;
      const row = await queryFirst(
        this.db,
        findCatalogSql(this.spec, columns),
        ...(values as SqlValue[]),
      );
      if (row) return Number(row.id);
    }
    return undefined;
  }

  private async write(
    id: number,
    values: { catalog: RowValues; entry: RowValues },
    overrides: Record<string, unknown>,
  ): Promise<void> {
    const userId = this.scope.userId();
    const catalog = releasedCatalog(this.spec, values.catalog);
    await this.db.batch([
      statement(this.db, `UPDATE ${this.table} SET ${assignments(catalog)} WHERE id = ?`, [
        ...Object.values(catalog),
        id,
      ]),
      statement(
        this.db,
        `UPDATE ${this.entryTable} SET ${assignments(values.entry)}, overrides = ?
           WHERE user_id = ? AND ${this.key} = ?`,
        [...Object.values(values.entry), JSON.stringify(overrides), userId, id],
      ),
    ]);
  }

  private split(values: RowValues): { catalog: RowValues; entry: RowValues } {
    return splitRow(this.entryColumns, values);
  }
}
