import { DatabaseSync } from 'node:sqlite';
import { isInternalTable } from './isInternalTable.js';
import { sqlLiteral } from './sqlLiteral.js';

interface MasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Turns a SQLite database into a SQL file that `wrangler d1 execute <database> --remote --file` can import into an
 * empty D1: foreign keys deferred, the tables, one INSERT per row, then the indexes, triggers and views. It has no
 * transaction statements and none of the internal tables, which D1 refuses; `d1_migrations` is created if missing and
 * its rows are inserted only when absent, so `wrangler d1 migrations apply` keeps working afterwards.
 */
export function dumpToSql(path: string): string {
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
    for (const table of tables) {
      const select = db.prepare(`SELECT * FROM ${quote(table.name)}`);
      select.setReadBigInts(true);
      const verb = table.name === 'd1_migrations' ? 'INSERT OR IGNORE' : 'INSERT';
      for (const row of select.iterate()) {
        const columns = Object.keys(row);
        statements.push(
          `${verb} INTO ${quote(table.name)} (${columns.map(quote).join(',')}) VALUES(${columns
            .map((column) => sqlLiteral(row[column]))
            .join(',')});`,
        );
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
    return `${statements.join('\n')}\n`;
  } finally {
    db.close();
  }
}
