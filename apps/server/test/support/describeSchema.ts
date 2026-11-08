import type { DatabaseSync } from 'node:sqlite';

export interface SchemaDescription {
  tables: Record<string, unknown[]>;
  foreignKeys: Record<string, unknown[]>;
  indexes: Record<string, unknown[]>;
  indexSql: Record<string, string>;
  other: string[];
}

const plain = (rows: unknown[]): unknown[] => rows.map((row) => ({ ...(row as object) }));
const omit = (row: object, key: string): object =>
  Object.fromEntries(Object.entries(row).filter(([k]) => k !== key));
const normaliseSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

export function describeSchema(db: DatabaseSync, ignoredTables: string[]): SchemaDescription {
  const master = db
    .prepare('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY name')
    .all() as { type: string; name: string; tbl_name: string; sql: string | null }[];
  const tableNames = master
    .filter((r) => r.type === 'table' && !ignoredTables.includes(r.name))
    .map((r) => r.name);

  const tables: SchemaDescription['tables'] = {};
  const foreignKeys: SchemaDescription['foreignKeys'] = {};
  const indexes: SchemaDescription['indexes'] = {};
  const indexSql: SchemaDescription['indexSql'] = {};

  for (const table of tableNames) {
    tables[table] = plain(
      db
        .prepare(`PRAGMA table_xinfo(${table})`)
        .all()
        .map((row) => omit(row, 'cid')),
    );
    foreignKeys[table] = plain(
      db
        .prepare(`PRAGMA foreign_key_list(${table})`)
        .all()
        .map((row) => omit(row, 'id')),
    );
    for (const index of db.prepare(`PRAGMA index_list(${table})`).all()) {
      const name = String(index.name);
      indexes[`${table}.${name.startsWith('sqlite_autoindex') ? 'auto' : name}`] ??= [];
      indexes[`${table}.${name.startsWith('sqlite_autoindex') ? 'auto' : name}`]!.push({
        unique: index.unique,
        origin: index.origin,
        partial: index.partial,
        columns: plain(db.prepare(`PRAGMA index_xinfo(${name})`).all()),
      });
    }
  }
  for (const r of master) {
    if (r.type === 'index' && r.sql) indexSql[r.name] = normaliseSql(r.sql);
  }
  return {
    tables,
    foreignKeys,
    indexes,
    indexSql,
    other: master.filter((r) => r.type === 'view' || r.type === 'trigger').map((r) => r.name),
  };
}
