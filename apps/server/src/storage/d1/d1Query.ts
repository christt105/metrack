import type { Row } from '../mapping/Row.js';
import type { SqlValue } from '../mapping/SqlValue.js';
import type { D1Database } from './D1Database.js';
import type { D1Meta } from './D1Meta.js';
import type { D1PreparedStatement } from './D1PreparedStatement.js';

/** A statement with its values bound, ready to run alone or inside a `batch`. */
export function statement(
  db: D1Database,
  sql: string,
  params: readonly SqlValue[] = [],
): D1PreparedStatement {
  return db.prepare(sql).bind(...params);
}

/** Every row the query returns. */
export async function queryAll(db: D1Database, sql: string, ...params: SqlValue[]): Promise<Row[]> {
  return (await statement(db, sql, params).all()).results;
}

/** The first row the query returns, if any. */
export async function queryFirst(
  db: D1Database,
  sql: string,
  ...params: SqlValue[]
): Promise<Row | undefined> {
  return (await statement(db, sql, params).first()) ?? undefined;
}

/** Runs a write and returns its counters. */
export async function execute(db: D1Database, sql: string, ...params: SqlValue[]): Promise<D1Meta> {
  return (await statement(db, sql, params).run()).meta;
}
