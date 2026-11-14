import { DatabaseSync } from 'node:sqlite';
import { chunkValue } from './chunkValue.js';
import { isInternalTable } from './isInternalTable.js';
import { sortTablesByDependency } from './sortTablesByDependency.js';
import { sqlLiteral } from './sqlLiteral.js';

/** D1 refuses a statement over 100 KB; stay well under it. */
export const MAX_STATEMENT_BYTES = 90_000;
const CHUNK_BUDGETS = [20_000, 2_000];
const ROWID = '_metrack_rowid';

interface MasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

type Row = Record<string, unknown>;

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function isLarge(value: unknown, budget: number): value is string | Uint8Array {
  return (
    (typeof value === 'string' && value.length * 2 > budget) ||
    (value instanceof Uint8Array && value.length * 2 > budget)
  );
}

function bytes(statement: string): number {
  return Buffer.byteLength(statement);
}

/** Turns one row into its INSERT and, when it is too long, the UPDATEs that append what was cut from it. */
function rowStatements(
  verb: string,
  table: string,
  row: Row,
  locate: (row: Row) => string,
): string[] {
  const columns = Object.keys(row).filter((column) => column !== ROWID);
  const insert = (values: unknown[]): string =>
    `${verb} INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES(${values.map(sqlLiteral).join(',')});`;
  const whole = insert(columns.map((column) => row[column]));
  if (bytes(whole) <= MAX_STATEMENT_BYTES) return [whole];
  for (const budget of CHUNK_BUDGETS) {
    const pieces = new Map<string, (string | Uint8Array)[]>();
    const first = columns.map((column) => {
      const value = row[column];
      if (!isLarge(value, budget)) return value;
      const chunks = chunkValue(value, budget);
      pieces.set(column, chunks);
      return chunks[0];
    });
    const statement = insert(first);
    if (bytes(statement) > MAX_STATEMENT_BYTES) continue;
    const statements = [statement];
    const where = locate(row);
    for (const [column, chunks] of pieces) {
      for (const chunk of chunks.slice(1)) {
        const append =
          typeof chunk === 'string'
            ? `${quote(column)} || ${sqlLiteral(chunk)}`
            : `CAST(${quote(column)} || ${sqlLiteral(chunk)} AS BLOB)`;
        statements.push(`UPDATE ${quote(table)} SET ${quote(column)} = ${append} WHERE ${where};`);
      }
    }
    return statements;
  }
  throw new Error(
    `A row of ${table} cannot be written in statements under ${MAX_STATEMENT_BYTES} bytes`,
  );
}

/**
 * The statements that rebuild a database in an empty D1, in order: foreign keys deferred, the tables, the rows of
 * each table (parents before the tables that reference them, so the import works even where the deferral does not
 * span the whole file), then the indexes, triggers and views. Rows too big for one D1 statement are inserted with
 * their large text and blob columns cut, and the rest is appended by UPDATEs. No transaction statements and no
 * internal tables, which D1 refuses; `d1_migrations` is created if missing and its rows are inserted only when
 * absent, so `wrangler d1 migrations apply` keeps working afterwards.
 */
export function dumpStatements(path: string): string[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const master = db
      .prepare(
        'SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid',
      )
      .all() as unknown as MasterRow[];
    const tables = master.filter((row) => row.type === 'table' && !isInternalTable(row.name));
    const statements = ['PRAGMA defer_foreign_keys=TRUE;'];
    for (const table of tables) {
      statements.push(
        table.name === 'd1_migrations'
          ? `${table.sql!.replace(/^CREATE TABLE (IF NOT EXISTS )?/i, 'CREATE TABLE IF NOT EXISTS ')};`
          : `${table.sql};`,
      );
    }
    const dependencies = new Map(
      tables.map((table) => [
        table.name,
        new Set(
          db
            .prepare(`PRAGMA foreign_key_list(${quote(table.name)})`)
            .all()
            .map((row) => String(row.table)),
        ),
      ]),
    );
    const names = tables.map((table) => table.name);
    const ordered = sortTablesByDependency(
      [
        ...names.filter((name) => name === 'd1_migrations'),
        ...names.filter((name) => name !== 'd1_migrations'),
      ],
      dependencies,
    );
    for (const name of ordered) {
      const table = tables.find((candidate) => candidate.name === name)!;
      const withoutRowid = /\)\s*WITHOUT\s+ROWID/i.test(table.sql!);
      const keys = db
        .prepare(`PRAGMA table_info(${quote(name)})`)
        .all()
        .filter((column) => Number(column.pk) > 0)
        .map((column) => String(column.name));
      const locate = (row: Row): string => {
        if (!withoutRowid) return `rowid = ${sqlLiteral(row[ROWID])}`;
        if (keys.length === 0) {
          throw new Error(`Table ${name} has no rowid and no primary key to locate its rows`);
        }
        return keys.map((key) => `${quote(key)} = ${sqlLiteral(row[key])}`).join(' AND ');
      };
      const select = db.prepare(
        withoutRowid
          ? `SELECT * FROM ${quote(name)}`
          : `SELECT rowid AS ${ROWID}, * FROM ${quote(name)}`,
      );
      select.setReadBigInts(true);
      const verb = name === 'd1_migrations' ? 'INSERT OR IGNORE' : 'INSERT';
      for (const row of select.iterate() as Iterable<Row>) {
        statements.push(...rowStatements(verb, name, row, locate));
      }
    }
    const hasSequences = master.some((row) => row.name === 'sqlite_sequence');
    const sequences = hasSequences
      ? db.prepare('SELECT name, seq FROM sqlite_sequence ORDER BY name').all()
      : [];
    if (sequences.length > 0) {
      statements.push('DELETE FROM sqlite_sequence;');
      for (const row of sequences) {
        statements.push(
          `INSERT INTO "sqlite_sequence" ("name","seq") VALUES(${sqlLiteral(row.name)},${sqlLiteral(row.seq)});`,
        );
      }
    }
    for (const row of master) {
      if (row.type === 'table' || isInternalTable(row.tbl_name)) continue;
      statements.push(`${row.sql};`);
    }
    return statements;
  } finally {
    db.close();
  }
}
